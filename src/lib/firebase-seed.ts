import { readBackup } from './model.ts'
import type { Snapshot } from './model.ts'
import { ALL_COLLECTIONS, groupKey, nameKey, normaliseEmail, plain, snapshotFromRecords, staffFromRecords, validId } from './firebase-schema.ts'
import type { Records } from './firebase-schema.ts'
import type { FirebaseBackup } from './firebase-store.ts'

/** Trusted admin bootstrap only. Browser clients cannot create stores or owners. */
export function seedRecords(snapshot:Snapshot):Records {
  readBackup({schemaVersion:1,exportedAt:new Date().toISOString(),snapshot,staff:[],privateNotes:{}})
  const records:Records=Object.fromEntries(ALL_COLLECTIONS.map(t=>[t,{}]))
  for(const table of ['brands','categories','departments'] as const)for(const row of snapshot[table]){
    validId(row.id)
    records[table][row.id]={...row,lastRequest:'bootstrap'}
    const key=`${table}|${nameKey(row.name)}`
    if(records.uniqueNames[key])throw new Error('Duplicate option names in seed.')
    records.uniqueNames[key]={table,entityId:row.id,lastRequest:'bootstrap'}
  }
  for(const l of snapshot.locations){validId(l.id);records.locations[l.id]={...l,stockCount:snapshot.placements.filter(p=>p.locationId===l.id).length,childCount:snapshot.locations.filter(c=>c.parentId===l.id).length,lastRequest:'bootstrap'};records.codes[nameKey(l.code)]={locationId:l.id,lastRequest:'bootstrap'}}
  for(const g of snapshot.groups){validId(g.id);records.groups[g.id]={...g,locationIds:snapshot.placements.filter(p=>p.groupId===g.id).map(p=>p.locationId),lastRequest:'bootstrap'};records.groupKeys[groupKey(g)]={groupId:g.id,lastRequest:'bootstrap'}}
  for(const m of snapshot.movements)records.movements[m.id]={...m,lastRequest:'bootstrap'}
  return records
}
export function addOwner(records:Records,uid:string,email:string){
  validId(uid);email=normaliseEmail(email)
  if(records.members[uid]||records.accessEmails[email])throw new Error('Owner identity already exists in this seed.')
  records.members[uid]={uid,email,role:'owner',lastRequest:'bootstrap'}
  records.accessEmails[email]={uid,role:'owner',lastRequest:'bootstrap'}
}

/** Recovery always targets a fresh store; retain all private receipts and identities. */
export function prepareRecovery(input:unknown,newId:string,name:string, timestamp:(iso:string)=>unknown){
  validId(newId)
  const b=input as FirebaseBackup
  readBackup(b)
  if(b.provider!=='firebase'||!b.firebase?.store||!b.firebase?.collections)throw new Error('Connected recovery requires a complete Firebase owner export.')
  if(newId===b.snapshot.store.id)throw new Error('Recover into a new store ID.')
  if(!name.trim()||name.length>160)throw new Error('Enter a store name of 1–160 characters.')
  const source=b.firebase.collections
  if(Object.keys(source).some(t=>!(ALL_COLLECTIONS as readonly string[]).includes(t)))throw new Error('Unknown collection in backup.')
  for(const t of ALL_COLLECTIONS)if(!source[t]||typeof source[t]!=='object'||Array.isArray(source[t]))throw new Error(`Backup is missing ${t}.`)
  const canonical=(x:unknown):string=>JSON.stringify(Array.isArray(x)?x.map(canonical).sort():x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical((x as Record<string,unknown>)[k])])):x)
  if(canonical(snapshotFromRecords(b.firebase.store,source))!==canonical(b.snapshot))throw new Error('Public snapshot does not match Firebase records.')
  const notes=Object.fromEntries(Object.values(source.commands).filter(c=>c.action==='movement').map(c=>[c.payload.id,c.payload.privateNote]))
  if(canonical(staffFromRecords(source))!==canonical(b.staff)||canonical(notes)!==canonical(b.privateNotes))throw new Error('Private snapshot does not match Firebase records.')
  const expected=seedRecords(b.snapshot)
  for(const t of ['codes','uniqueNames','groupKeys']){
    const strip=(rows:Records[string])=>Object.fromEntries(Object.entries(rows).map(([id,{lastRequest,...r}])=>[id,r]))
    if(canonical(strip(source[t]))!==canonical(strip(expected[t])))throw new Error(`Invalid ${t} index.`)
  }
  for(const [id,l]of Object.entries(source.locations))if(l.stockCount!==expected.locations[id]?.stockCount||l.childCount!==expected.locations[id]?.childCount)throw new Error('Invalid location counters.')
  let owners=0
  for(const [uid,m]of Object.entries(source.members)){
    validId(uid)
    if(m.uid!==uid||normaliseEmail(m.email)!==m.email||!['owner','editor'].includes(m.role)||source.accessEmails[m.email]?.uid!==uid||source.accessEmails[m.email]?.role!==m.role)throw new Error('Invalid membership index.')
    if(m.role==='owner')owners++
  }
  if(!owners||Object.keys(source.accessEmails).length!==Object.keys(source.members).length)throw new Error('Backup must contain an owner and matching account indexes.')
  for(const [email,i]of Object.entries(source.invitations))if(email!==normaliseEmail(email)||i.email!==email||i.role!=='editor'||source.accessEmails[email])throw new Error('Invalid invitation.')
  const records:Records=plain(source)
  for(const t of ALL_COLLECTIONS)for(const [id,row]of Object.entries(records[t])){
    if(!id||id.includes('/')||id==='.'||id==='..')throw new Error('Invalid document ID in backup.')
    if(['movements','commands','invitations'].includes(t)){
      if(typeof row.at!=='string'||!Number.isFinite(Date.parse(row.at)))throw new Error('Invalid record timestamp.')
      row.at=timestamp(row.at)
    }
  }
  return {store:{...b.firebase.store,id:newId,name:name.trim()},records}
}
