import { ConflictError, groupLabel, locationLabel, readBackup, requireText } from './model'
import type { Snapshot, Request, Role, Staff, Backup } from './model'
import { createSample } from './sample'
export type DemoData = { snapshot: Snapshot; staff: Staff[]; privateNotes: Record<string, string>; receipts: Record<string, { signature: string; actor: Role }> }
export const STORAGE_KEY = 'incu-sprint1-sample-v1'
export function newDemoData(): DemoData { return { snapshot: createSample(), staff: [{ id: 'sample-owner', email: 'owner@example.invalid', role: 'owner', status: 'active' }], privateNotes: {}, receipts: {} } }
// Pure reducer: storage is written only after every constraint has passed.
export function applyDemo(input: DemoData, request: Request, role: Role): DemoData {
  if (role === 'guest') throw new Error('Only invited staff can save changes.')
  const signature = JSON.stringify({ action: request.action, payload: request.payload })
  const receipt = input.receipts[request.requestId]
  if (receipt) {
    if (receipt.signature !== signature || receipt.actor !== role) throw new Error('This retry ID belongs to a different save. Close the form and start again.')
    return input
  }
  if (request.expectedRevision !== input.snapshot.store.revision) throw new ConflictError()
  const next = structuredClone(input), s = next.snapshot
  const p = request.payload
  switch (request.action) {
    case 'group': {
      const p = request.payload
      if (!s.brands.some(x => x.id === p.brandId && x.active) || !s.categories.some(x => x.id === p.categoryId && x.active) || !s.departments.some(x => x.id === p.departmentId && x.active)) throw new Error('Choose an active brand, category, and department.')
      if (s.groups.some(x => x.brandId === p.brandId && x.categoryId === p.categoryId && x.departmentId === p.departmentId)) throw new Error('This stock group already exists. Find it in the directory to add a location.')
      s.groups.push({ ...p }); break
    }
    case 'location': {
      const p = request.payload
      requireText(p.area, 'Area'); requireText(p.code, 'Location code')
      if (!['Cabinet', 'Rack', 'Shelf', 'Drawer', 'Room', 'Wall', 'Tub', 'Area'].includes(p.kind)) throw new Error('Choose a location type.')
      if (s.locations.some(x => x.code.toLowerCase() === p.code.trim().toLowerCase() && x.id !== p.id)) throw new Error('That location code is already in use.')
      const parent = s.locations.find(x => x.id === p.parentId)
      if (p.parentId && (!parent || parent.parentId || parent.id === p.id || parent.area !== p.area)) throw new Error('Choose a storage unit in the same area.')
      if (p.parentId && s.locations.some(x => x.parentId === p.id)) throw new Error('A unit with drawers or shelves cannot become a child location.')
      if (s.locations.some(x => x.parentId === p.id && x.area !== p.area)) throw new Error('Update the child locations before changing this area.')
      const row = { ...p, code: p.code.trim().toUpperCase(), area: p.area.trim() }
      s.locations = [...s.locations.filter(x => x.id !== p.id), row]; break
    }
    case 'deleteLocation': {
      const p = request.payload
      if (!s.locations.some(x => x.id === p.id)) throw new Error('This location no longer exists.')
      if (s.placements.some(x => x.locationId === p.id)) throw new Error('Move or remove all stock links before deleting this location.')
      if (s.locations.some(x => x.parentId === p.id)) throw new Error('Remove the drawers or shelves inside this unit first.')
      s.locations = s.locations.filter(x => x.id !== p.id); break
    }
    case 'taxon': {
      const p = request.payload
      requireText(p.name, 'Name')
      if (!['brands','categories','departments'].includes(p.table)) throw new Error('Invalid option type.')
      const rows = s[p.table]
      if (rows.some(x => x.name.toLowerCase() === p.name.trim().toLowerCase() && x.id !== p.id)) throw new Error('That name already exists.')
      const old = rows.find(x => x.id === p.id)
      if (old) Object.assign(old, { name: p.name.trim(), active: p.active })
      else if (p.table === 'brands') s.brands.push({ id: p.id, name: p.name.trim(), active: p.active, aliases: [], sourcePages: [], retrievedOn: null, departments: [] })
      else s[p.table].push({ id: p.id, name: p.name.trim(), active: p.active })
      break
    }
    case 'movement': {
      const p = request.payload
      const g = s.groups.find(x => x.id === p.groupId)
      if (!g) throw new Error('This stock group no longer exists.')
      if (!['place', 'also', 'move', 'correct', 'remove'].includes(p.kind)) throw new Error('Choose a movement action.')
      const links = s.placements.filter(x => x.groupId === p.groupId)
      const removes = ['move', 'correct', 'remove'].includes(p.kind)
      const adds = p.kind !== 'remove'
      if (removes && (!p.from || !links.some(x => x.locationId === p.from))) throw new Error('The selected source is no longer linked to this stock group.')
      if (!removes && p.from) throw new Error('An extra location does not have a source.')
      if (adds && (!p.to || !s.locations.some(x => x.id === p.to))) throw new Error('Choose a destination location.')
      if (!adds && p.to) throw new Error('A removal cannot have a destination.')
      if (p.from && p.from === p.to) throw new Error('Choose a different destination.')
      if (p.kind === 'place' && links.length) throw new Error('This group is already placed. Use “Also store here”.')
      if (p.kind === 'also' && !links.length) throw new Error('Use a first placement for this group.')
      if (['correct', 'remove'].includes(p.kind)) requireText(p.reason, 'Correction reason')
      if (p.reason.length > 160 || p.privateNote.length > 2000) throw new Error('The reason or staff note is too long.')
      if (adds && !removes && links.some(x => x.locationId === p.to)) throw new Error('This stock group is already at that location.')
      if (removes) s.placements = s.placements.filter(x => !(x.groupId === p.groupId && x.locationId === p.from))
      if (adds && !s.placements.some(x => x.groupId === p.groupId && x.locationId === p.to)) s.placements.push({ groupId: p.groupId, locationId: p.to! })
      s.movements.push({ id: p.id, groupId: p.groupId, kind: p.kind, groupLabel: groupLabel(s, g), from: p.from, to: p.to, fromLabel: p.from ? locationLabel(s, p.from) : null, toLabel: p.to ? locationLabel(s, p.to) : null, reason: p.reason.trim(), at: new Date().toISOString() })
      next.privateNotes[p.id] = p.privateNote.trim()
      break
    }
    case 'invite': {
      if (role !== 'owner') throw new Error('Only the owner can manage staff.')
      const p = request.payload, email = p.email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email address.')
      if (next.staff.some(x => x.email === email)) throw new Error('This person already has access or an invitation.')
      next.staff.push({ id: p.id, email, role: 'editor', status: 'invited' }); break
    }
    case 'revoke': {
      if (role !== 'owner') throw new Error('Only the owner can manage staff.')
      if (next.staff.some(x => x.id === p.id && x.role === 'owner')) throw new Error('Owner access cannot be removed here.')
      next.staff = next.staff.filter(x => x.id !== p.id); break
    }
  }
  s.store.revision++
  next.receipts[request.requestId] = { signature, actor: role }
  return next
}
export function readDemo(): DemoData {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) { const initial = newDemoData(); localStorage.setItem(STORAGE_KEY, JSON.stringify(initial)); return initial }
  try { return JSON.parse(raw) as DemoData } catch { throw new Error('The sample workspace could not be read. Recover a backup or clear this site’s sample data in your browser settings.') }
}
export async function saveDemo(request: Request, role: Role): Promise<Snapshot> {
  const save = async () => {
    const next = applyDemo(readDemo(), request, role)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next.snapshot
  }
  // Web Locks serialise writes from multiple tabs on supported secure origins.
  if (navigator.locks) return navigator.locks.request(STORAGE_KEY, save)
  throw new Error('This browser needs a secure connection and Web Locks to edit sample data. Use a current browser on localhost or HTTPS.')
}
export function exportDemo(role: Role): Backup {
  if (role !== 'owner') throw new Error('Only the owner can export store data.')
  const d = readDemo()
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), snapshot: d.snapshot, staff: d.staff, privateNotes: d.privateNotes }
}
export async function restoreDemo(input: unknown, role: Role): Promise<void> {
  if (role !== 'owner') throw new Error('Only the owner can recover sample data.')
  const b = readBackup(input)
  if (!navigator.locks) throw new Error('Recovery requires Web Locks on localhost or HTTPS.')
  await navigator.locks.request(STORAGE_KEY, () => {
    const current = readDemo()
    b.snapshot.store.revision = current.snapshot.store.revision + 1
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ snapshot: b.snapshot, staff: b.staff, privateNotes: b.privateNotes, receipts: {} }))
  })
}
