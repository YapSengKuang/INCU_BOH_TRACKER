import type { Snapshot, Staff } from './model.ts'
export const PUBLIC_COLLECTIONS = ['brands','categories','departments','locations','groups','movements'] as const
export const PRIVATE_COLLECTIONS = ['members','invitations','accessEmails','commands'] as const
export const ALL_COLLECTIONS = [...PUBLIC_COLLECTIONS,'codes','uniqueNames','groupKeys',...PRIVATE_COLLECTIONS] as const
export type CollectionName = typeof ALL_COLLECTIONS[number]
export type Records = Record<string, Record<string, Record<string, any>>>
export const nameKey = (name:string) => name.toLowerCase().replaceAll('%','%25').replaceAll('/','%2f').replaceAll('.','%2e')
export const groupKey = (g:{brandId:string;categoryId:string;departmentId:string}) => `${g.brandId}|${g.categoryId}|${g.departmentId}`
export function validId(id:string) { if (!/^[A-Za-z0-9_#-]{1,160}$/.test(id)) throw new Error('Invalid record ID.') }
export function normaliseEmail(value:string) {
  const email=value.trim().toLowerCase()
  if(email.length>254 || !/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email)) throw new Error('Enter a valid email address.')
  return email
}
export function plain(value:any):any {
  if(value && typeof value.toDate==='function') return value.toDate().toISOString()
  if(Array.isArray(value)) return value.map(plain)
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,plain(v)]))
  return value
}
export function snapshotFromRecords(store:any, records:Records):Snapshot {
  const rows=(t:string)=>Object.values(records[t]??{})
  const groups=rows('groups')
  return {
    store:{id:store.id,name:store.name,timezone:store.timezone,revision:store.revision},
    brands:rows('brands').map(({lastRequest,...r})=>r) as Snapshot['brands'],
    categories:rows('categories').map(({lastRequest,...r})=>r) as Snapshot['categories'],
    departments:rows('departments').map(({lastRequest,...r})=>r) as Snapshot['departments'],
    locations:rows('locations').map(({stockCount,childCount,lastRequest,...r})=>r) as Snapshot['locations'],
    groups:groups.map(({locationIds,lastRequest,...r})=>r) as Snapshot['groups'],
    placements:groups.flatMap(g=>g.locationIds.map((locationId:string)=>({groupId:g.id,locationId}))),
    movements:rows('movements').map(({lastRequest,...r})=>plain(r)) as Snapshot['movements']
  }
}
export function staffFromRecords(records:Records):Staff[] {
  return [...Object.values(records.members??{}).map(m=>({id:`member:${m.uid}`,email:m.email,role:m.role,status:'active'} as Staff)),
    ...Object.values(records.invitations??{}).map(i=>({id:`invitation:${i.email}`,email:i.email,role:'editor',status:'invited'} as Staff))]
    .sort((a,b)=>a.email.localeCompare(b.email))
}
