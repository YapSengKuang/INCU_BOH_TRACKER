import { collection, doc, getDocFromServer, getDocsFromServer } from 'firebase/firestore'
import type { DocumentData, Firestore } from 'firebase/firestore'
import { ALL_COLLECTIONS, PUBLIC_COLLECTIONS, plain, snapshotFromRecords, staffFromRecords } from './firebase-schema.ts'
import type { Records } from './firebase-schema.ts'
import { ConflictError } from './model.ts'
import type { Backup, Snapshot } from './model.ts'
export type FirebaseBackup = Backup & { provider:'firebase';firebase:{store:DocumentData;collections:Records} }
export async function readConsistentStore(db:Firestore,storeId:string,full=false):Promise<{snapshot:Snapshot;store:DocumentData;records:Records}> {
  const root=doc(db,'stores',storeId)
  // All ordinary writes advance this revision, so equal before/after reads
  // bound a coherent export without needing a paid server or query transaction.
  for(let attempt=0;attempt<3;attempt++){
    const before=await getDocFromServer(root)
    if(!before.exists())throw new Error('Store not found. Complete Firebase setup before connecting this build.')
    const records:Records={}
    await Promise.all((full?ALL_COLLECTIONS:PUBLIC_COLLECTIONS).map(async t=>{
      const rows=await getDocsFromServer(collection(db,'stores',storeId,t))
      records[t]=Object.fromEntries(rows.docs.map(d=>[d.id,d.data()]))
    }))
    const after=await getDocFromServer(root)
    if(after.data()?.revision===before.data().revision)return {snapshot:snapshotFromRecords(before.data(),records),store:before.data(),records}
  }
  throw new ConflictError()
}
export async function exportFirebaseStore(db:Firestore,storeId:string):Promise<FirebaseBackup> {
  const data=await readConsistentStore(db,storeId,true)
  const notes=Object.values(data.records.commands??{}).filter(c=>c.action==='movement').map(c=>[c.payload.id,c.payload.privateNote])
  return {schemaVersion:1,provider:'firebase',exportedAt:new Date().toISOString(),snapshot:data.snapshot,
    staff:staffFromRecords(data.records),privateNotes:Object.fromEntries(notes),firebase:plain({store:data.store,collections:data.records})}
}
