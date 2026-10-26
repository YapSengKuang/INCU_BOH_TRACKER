export type Role = 'guest' | 'editor' | 'owner'
export type Kind = 'Cabinet' | 'Rack' | 'Shelf' | 'Drawer' | 'Room' | 'Wall' | 'Tub' | 'Area'
export type Taxon = { id: string; name: string; active: boolean }
export type Brand = Taxon & { aliases: string[]; departments: string[]; sourcePages: string[]; retrievedOn: string | null }
export type Location = { id: string; area: string; code: string; kind: Kind; parentId: string | null }
export type StockGroup = { id: string; brandId: string; categoryId: string; departmentId: string }
export type Placement = { groupId: string; locationId: string }
export type Movement = { id: string; groupId: string; kind: MoveKind; groupLabel: string; from: string | null; to: string | null; fromLabel: string | null; toLabel: string | null; reason: string; at: string }
export type MoveKind = 'place' | 'also' | 'move' | 'correct' | 'remove'
export type Snapshot = {
  store: { id: string; name: string; timezone: string; revision: number }
  brands: Brand[]; categories: Taxon[]; departments: Taxon[]; locations: Location[]; groups: StockGroup[]; placements: Placement[]; movements: Movement[]
}
export type Staff = { id: string; email: string; role: 'owner' | 'editor'; status: 'active' | 'invited' }
export type Command =
  | { action: 'group'; payload: { id: string; brandId: string; categoryId: string; departmentId: string } }
  | { action: 'location'; payload: Location }
  | { action: 'deleteLocation'; payload: { id: string } }
  | { action: 'taxon'; payload: { table: 'brands' | 'categories' | 'departments'; id: string; name: string; active: boolean } }
  | { action: 'movement'; payload: { id: string; groupId: string; kind: MoveKind; from: string | null; to: string | null; reason: string; privateNote: string } }
  | { action: 'invite'; payload: { id: string; email: string } }
  | { action: 'revoke'; payload: { id: string } }
export type Request = Command & { requestId: string; expectedRevision: number }
export class ConflictError extends Error { constructor() { super('The store changed while you were editing. Load the latest data, review your entry, then save again.'); this.name = 'ConflictError' } }
export function locationLabel(s: Snapshot, id: string | null): string {
  const l = s.locations.find(x => x.id === id)
  if (!l) return 'Location removed'
  const parent = l.parentId && s.locations.find(x => x.id === l.parentId)
  return `${l.area} → ${parent ? `${parent.kind} ${parent.code} → ` : ''}${l.kind} ${l.code}`
}
export function groupLabel(s: Snapshot, g: StockGroup): string {
  return [s.brands.find(x => x.id === g.brandId)?.name, s.categories.find(x => x.id === g.categoryId)?.name, s.departments.find(x => x.id === g.departmentId)?.name].join(' · ')
}
export function searchGroups(s: Snapshot, query: string, brand = '', category = '', department = '', area = '') {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  return s.groups.filter(g => {
    const b = s.brands.find(x => x.id === g.brandId)
    const places = s.placements.filter(p => p.groupId === g.id)
    const haystack = `${groupLabel(s, g)} ${b?.aliases.join(' ')} ${places.map(p => locationLabel(s, p.locationId)).join(' ')}`.toLocaleLowerCase()
    return words.every(w => haystack.includes(w)) && (!brand || brand === g.brandId) && (!category || category === g.categoryId) && (!department || department === g.departmentId) && (!area || places.some(p => s.locations.find(l => l.id === p.locationId)?.area === area))
  }).sort((a, b) => groupLabel(s, a).localeCompare(groupLabel(s, b)))
}
export function requireText(value: string, label: string) { if (!value.trim() || value.length > 160) throw new Error(`${label} must have between 1 and 160 characters.`) }
export type Backup = { schemaVersion: 1; exportedAt: string; snapshot: Snapshot; staff: Staff[]; privateNotes: Record<string, string> }
export function readBackup(input: unknown): Backup {
  const b = input as Backup
  if (!b || b.schemaVersion !== 1 || !b.snapshot?.store?.id || !Number.isInteger(b.snapshot.store.revision)) throw new Error('This is not a supported Sprint 1 backup.')
  const s = b.snapshot
  for (const key of ['brands', 'categories', 'departments', 'locations', 'groups', 'placements', 'movements'] as const) if (!Array.isArray(s[key])) throw new Error(`Backup is missing ${key}.`)
  const unique = (rows: { id: string }[]) => new Set(rows.map(x => x.id)).size === rows.length && rows.every(x => typeof x.id === 'string' && x.id)
  if (![s.brands, s.categories, s.departments, s.locations, s.groups, s.movements].every(unique)) throw new Error('Backup contains invalid or duplicate IDs.')
  if (!s.store.name || !s.store.timezone || !Array.isArray(b.staff) || !b.privateNotes || typeof b.privateNotes !== 'object') throw new Error('Backup is incomplete.')
  try { new Intl.DateTimeFormat('en', { timeZone: s.store.timezone }) } catch { throw new Error('Invalid store timezone.') }
  for (const rows of [s.brands, s.categories, s.departments]) for (const x of rows) if (typeof x.name !== 'string' || typeof x.active !== 'boolean') throw new Error('Invalid brand or category data.')
  if (s.brands.some(x => !Array.isArray(x.aliases) || !Array.isArray(x.sourcePages) || !Array.isArray(x.departments))) throw new Error('Invalid brand provenance.')
  for (const g of s.groups) if (!s.brands.some(x => x.id === g.brandId) || !s.categories.some(x => x.id === g.categoryId) || !s.departments.some(x => x.id === g.departmentId)) throw new Error('Backup contains a stock group with missing options.')
  for (const l of s.locations) if (!['Cabinet','Rack','Shelf','Drawer','Room','Wall','Tub','Area'].includes(l.kind) || !l.area || !l.code || (l.parentId && !s.locations.some(p => p.id === l.parentId && !p.parentId && p.area === l.area))) throw new Error('Backup contains an invalid location.')
  if (new Set(s.locations.map(l => l.code.toLowerCase())).size !== s.locations.length) throw new Error('Backup contains duplicate location codes.')
  if (new Set(s.groups.map(g => `${g.brandId}|${g.categoryId}|${g.departmentId}`)).size !== s.groups.length) throw new Error('Backup contains duplicate stock groups.')
  for (const p of s.placements) if (!s.groups.some(g => g.id === p.groupId) || !s.locations.some(l => l.id === p.locationId)) throw new Error('Backup contains a broken stock location.')
  if (new Set(s.placements.map(p => `${p.groupId}|${p.locationId}`)).size !== s.placements.length) throw new Error('Backup contains duplicate stock links.')
  for (const m of s.movements) if (!s.groups.some(g => g.id === m.groupId) || !['place','also','move','correct','remove'].includes(m.kind) || !m.groupLabel || !Number.isFinite(Date.parse(m.at))) throw new Error('Backup contains invalid history.')
  if (b.staff.some(x => !x.id || !x.email || !['owner','editor'].includes(x.role) || !['active','invited'].includes(x.status)) || !unique(b.staff)) throw new Error('Backup contains invalid staff access.')
  return b
}
