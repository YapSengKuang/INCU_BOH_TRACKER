import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { afterAll,beforeAll,beforeEach,describe,expect,it } from 'vitest'
import { initializeTestEnvironment,assertFails } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc,getDoc,getDocs,collection,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp,Timestamp } from 'firebase/firestore'
import type { DocumentData, Firestore } from 'firebase/firestore'
import { applyFirebaseCommand } from '../../src/lib/firebase-commands.ts'
import type { FirebaseRequest,Actor } from '../../src/lib/firebase-commands.ts'
import { seedRecords,addOwner,prepareRecovery } from '../../src/lib/firebase-seed.ts'
import { exportFirebaseStore,readConsistentStore } from '../../src/lib/firebase-store.ts'
import type { MoveKind, Snapshot } from '../../src/lib/model.ts'

let env:RulesTestEnvironment
const owner:Actor={uid:'owner',email:'owner@example.com',emailVerified:true},editor:Actor={uid:'editor',email:'editor@example.com',emailVerified:true}
const actorDb=(actor:Actor)=>env.authenticatedContext(actor.uid,{email:actor.email,email_verified:actor.emailVerified}).firestore() as unknown as Firestore
const ref=(db:Firestore,t:string,id:string)=>doc(db,'stores','main',t,id)
const fixture:Snapshot={store:{id:'main',name:'BOH test',timezone:'Australia/Sydney',revision:0},brands:[{id:'brand',name:'Brand',active:true,aliases:[],departments:[],sourcePages:[],retrievedOn:null}],categories:[{id:'category',name:'Category',active:true}],departments:[{id:'department',name:'Department',active:true}],locations:[{id:'a',area:'Room',kind:'Cabinet',code:'A',parentId:null},{id:'b',area:'Room',kind:'Rack',code:'B',parentId:null},{id:'child',area:'Room',kind:'Drawer',code:'A1',parentId:'a'}],groups:[{id:'group',brandId:'brand',categoryId:'category',departmentId:'department'}],placements:[],movements:[]}
async function run(db:Firestore,actor:Actor,command:Pick<FirebaseRequest,'action'|'payload'>,expected?:number,requestId=crypto.randomUUID()){
  const revision=expected??(await getDoc(doc(db,'stores','main'))).data()!.revision
  const request={...command,expectedRevision:revision,requestId} as FirebaseRequest
  await applyFirebaseCommand(db,'main',request,actor);return request
}
const movement=(id:string,kind:MoveKind,from:string|null,to:string|null)=>({action:'movement' as const,payload:{id,groupId:'group',kind,from,to,reason:'Verified',privateNote:'Private staff note'}})
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-boh',firestore:{host:'127.0.0.1',port:8787,rules:readFileSync('firebase/firestore.rules','utf8')}})})
afterAll(async()=>{await env?.cleanup()})
beforeEach(async()=>{
  await env.clearFirestore()
  const records=seedRecords(fixture);addOwner(records,owner.uid,owner.email)
  records.members.editor={uid:editor.uid,email:editor.email,role:'editor',lastRequest:'bootstrap'}
  records.accessEmails[editor.email]={uid:editor.uid,role:'editor',lastRequest:'bootstrap'}
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore() as unknown as Firestore,batch=writeBatch(db)
    batch.set(doc(db,'stores','main'),{...fixture.store,lastRequest:'bootstrap'})
    for(const [t,rows]of Object.entries(records))for(const [id,d]of Object.entries(rows))batch.set(ref(db,t,id),d)
    await batch.commit()
  })
})
describe('Firestore permissions and atomic stock commands',()=>{
  it('runs the actual administrator seed once without importing sample inventory',async()=>{
    const args=['scripts/firebase-admin.ts','seed','--project','demo-boh','--store','seeded','--name','BOH']
    const options={env:{...process.env,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8787'},timeout:15000}
    expect(execFileSync(process.execPath,args,options).toString()).toContain('Seeded')
    const db=env.unauthenticatedContext().firestore() as unknown as Firestore
    const {snapshot}=await readConsistentStore(db,'seeded')
    expect(snapshot.brands).toHaveLength(140);expect(snapshot.brands.every(b=>!b.active)).toBe(true)
    expect(snapshot.locations).toEqual([]);expect(snapshot.groups).toEqual([])
    expect(()=>execFileSync(process.execPath,args,{...options,stdio:'pipe'})).toThrow()
  })
  it('allows guest directory and history reads, denies private reads and all guest writes',async()=>{
    const db=env.unauthenticatedContext().firestore() as unknown as Firestore
    expect((await readConsistentStore(db,'main')).snapshot.locations).toHaveLength(3)
    for(const t of ['members','invitations','accessEmails','commands'])await assertFails(getDocs(collection(db,'stores','main',t)))
    await assertFails(updateDoc(ref(db,'locations','a'),{code:'HACK'}))
    await assertFails(getDoc(doc(db,'anything','secret')))
  })
  it('supports placements, merging a move, child addresses, immutable history and idempotent retry',async()=>{
    const db=actorDb(editor)
    const first=await run(db,editor,movement('one','place',null,'child'))
    await applyFirebaseCommand(db,'main',first,editor)
    await run(db,editor,movement('two','also',null,'b'))
    await run(db,editor,movement('three','move','child','b'))
    const result=(await readConsistentStore(db,'main')).snapshot
    expect(result.store.revision).toBe(3);expect(result.placements).toEqual([{groupId:'group',locationId:'b'}])
    expect(result.movements.find(m=>m.id==='one')?.toLabel).toBe('Room → Cabinet A → Drawer A1')
    expect((await getDoc(ref(db,'locations','child'))).data()?.stockCount).toBe(0)
    expect((await getDoc(ref(db,'locations','b'))).data()?.stockCount).toBe(1)
    expect(JSON.stringify(result)).not.toContain('Private staff note')
    await assertFails(updateDoc(ref(db,'movements','one'),{reason:'rewrite'}))
    await assertFails(deleteDoc(ref(db,'movements','one')))
    await run(db,editor,movement('four','remove','b',null));expect((await getDoc(ref(db,'groups','group'))).data()?.locationIds).toEqual([])
  })
  it('creates and renames options, enforces unique names and creates groups',async()=>{
    const db=actorDb(editor)
    await run(db,editor,{action:'taxon',payload:{table:'brands',id:'newbrand',name:'New / Brand.',active:true}})
    await run(db,editor,{action:'taxon',payload:{table:'brands',id:'newbrand',name:'Renamed',active:true}})
    await expect(run(db,editor,{action:'taxon',payload:{table:'brands',id:'duplicate',name:'renamed',active:true}})).rejects.toThrow('already exists')
    await run(db,editor,{action:'group',payload:{id:'newgroup',brandId:'newbrand',categoryId:'category',departmentId:'department'}})
    await expect(run(db,editor,{action:'group',payload:{id:'duplicate',brandId:'newbrand',categoryId:'category',departmentId:'department'}})).rejects.toThrow('already exists')
  })
  it('maintains parent counters through creation, reparenting, code changes and deletion',async()=>{
    const db=actorDb(editor)
    await run(db,editor,{action:'location',payload:{id:'new',area:'Room',code:'B1',kind:'Tub',parentId:'b'}})
    await run(db,editor,{action:'location',payload:{id:'new',area:'Room',code:'A2',kind:'Shelf',parentId:'a'}})
    expect((await getDoc(ref(db,'locations','a'))).data()?.childCount).toBe(2)
    expect((await getDoc(ref(db,'locations','b'))).data()?.childCount).toBe(0)
    await run(db,editor,{action:'deleteLocation',payload:{id:'new'}})
    expect((await getDoc(ref(db,'locations','a'))).data()?.childCount).toBe(1)
    await expect(run(db,editor,{action:'deleteLocation',payload:{id:'a'}})).rejects.toThrow('inside this unit')
    await run(db,editor,movement('occupied','place',null,'b'))
    await expect(run(db,editor,{action:'deleteLocation',payload:{id:'b'}})).rejects.toThrow('stock links')
  })
  it('invites verified accounts, claims once, revokes immediately and prevents owner escalation',async()=>{
    const db=actorDb(owner),newActor={uid:'newstaff',email:'new@example.com',emailVerified:true},staffDb=actorDb(newActor)
    await assertFails(setDoc(ref(staffDb,'members','newstaff'),{uid:'newstaff',email:newActor.email,role:'owner'}))
    await run(db,owner,{action:'invite',payload:{id:'invite',email:'NEW@example.com'}})
    await expect(run(actorDb({...newActor,emailVerified:false}),{...newActor,emailVerified:false},{action:'claim',payload:{id:newActor.uid,email:newActor.email}})).rejects.toThrow('verified')
    await run(staffDb,newActor,{action:'claim',payload:{id:newActor.uid,email:newActor.email}})
    expect((await getDoc(ref(staffDb,'members',newActor.uid))).data()?.role).toBe('editor')
    await assertFails(getDocs(collection(staffDb,'stores','main','members')))
    await assertFails(updateDoc(ref(staffDb,'members',newActor.uid),{role:'owner'}))
    await run(db,owner,{action:'revoke',payload:{id:'member:newstaff'}})
    await expect(run(staffDb,newActor,movement('denied','place',null,'b'))).rejects.toThrow('Only invited')
    await expect(run(db,owner,{action:'revoke',payload:{id:'member:owner'}})).rejects.toThrow('Owner access')
    await expect(run(staffDb,newActor,{action:'claim',payload:{id:newActor.uid,email:newActor.email}})).rejects.toThrow('No store invitation')
  })
  it('rejects stale edits and lets only one competing command commit',async()=>{
    const db=actorDb(editor),results=await Promise.allSettled([run(db,editor,movement('race1','place',null,'a'),0),run(db,editor,movement('race2','place',null,'b'),0)])
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    expect((await readConsistentStore(db,'main')).snapshot.movements).toHaveLength(1)
    await expect(run(db,editor,movement('stale','also',null,'child'),0)).rejects.toThrow('store changed')
  })
  it('rejects direct data corruption, unpaired receipts, forged history and cross-store changes atomically',async()=>{
    const db=actorDb(editor)
    for(const change of [{stockCount:-1},{parentId:'a'},{code:'DUPLICATE'},{privateNote:'leak'},{childCount:99}])await assertFails(updateDoc(ref(db,'locations','b'),change))
    const rid='forged',batch=writeBatch(db)
    batch.update(doc(db,'stores','main'),{revision:1,lastRequest:rid})
    batch.set(ref(db,'commands',rid),{id:rid,actor:editor.uid,at:serverTimestamp(),expectedRevision:0,revision:1,action:'movement',payload:{...movement('fake','place',null,'b').payload,groupLabel:'Forged'},signature:'forged'})
    batch.update(ref(db,'groups','group'),{locationIds:['b'],lastRequest:rid})
    batch.set(ref(db,'movements','fake'),{id:'fake',groupId:'group',kind:'place',from:null,to:'b',fromLabel:null,toLabel:'Room → Rack B',groupLabel:'Forged',reason:'Verified',at:serverTimestamp(),lastRequest:rid})
    await assertFails(batch.commit())
    expect((await getDoc(doc(db,'stores','main'))).data()?.revision).toBe(0)
    await assertFails(setDoc(doc(db,'stores','other','locations','x'),{id:'x'}))
    await assertFails(updateDoc(doc(db,'stores','main'),{name:'Owned'}))
    await assertFails(setDoc(ref(db,'commands','alone'),{actor:editor.uid}))
  })
  it('independently validates every public/private movement field against hostile batches',async()=>{
    const db=actorDb(editor)
    const variants=['missing-counter','forged-label','forged-address','private-leak','extra-payload','oversized-note','wrong-actor','wrong-time','missing-history','wrong-counter','duplicate-link','unverified','uninvited']
    for(const variant of variants){
      const client=variant==='unverified'?actorDb({...editor,emailVerified:false}):variant==='uninvited'?actorDb({uid:'stranger',email:'stranger@example.com',emailVerified:true}):db
      const rid=`hostile-${variant}`,mid=`movement-${variant}`,batch=writeBatch(client)
      const p:DocumentData={...movement(mid,'place',null,'b').payload,groupLabel:'Brand · Category · Department'}
      const history:DocumentData={id:mid,groupId:'group',kind:'place',from:null,to:'b',fromLabel:null,toLabel:'Room → Rack B',groupLabel:p.groupLabel,reason:'Verified',at:serverTimestamp(),lastRequest:rid}
      if(variant==='forged-label'){p.groupLabel='Fake';history.groupLabel='Fake'}
      if(variant==='forged-address')history.toLabel='Fake address'
      if(variant==='private-leak')history.privateNote='Secret'
      if(variant==='extra-payload')p.unexpected={data:'extra'}
      if(variant==='oversized-note')p.privateNote='x'.repeat(2001)
      batch.update(doc(client,'stores','main'),{revision:1,lastRequest:rid})
      batch.set(ref(client,'commands',rid),{id:rid,actor:variant==='wrong-actor'?'owner':editor.uid,at:variant==='wrong-time'?Timestamp.fromMillis(0):serverTimestamp(),expectedRevision:0,revision:1,action:'movement',payload:p,signature:'raw'})
      batch.update(ref(client,'groups','group'),{locationIds:variant==='duplicate-link'?['b','b']:['b'],lastRequest:rid})
      if(variant!=='missing-counter')batch.update(ref(client,'locations','b'),{stockCount:variant==='wrong-counter'?2:1,lastRequest:rid})
      if(variant!=='missing-history')batch.set(ref(client,'movements',mid),history)
      await assertFails(batch.commit())
      expect((await getDoc(doc(db,'stores','main'))).data()?.revision,variant).toBe(0)
    }
  })
  it('exports private records only for owners and restores a complete backup into a fresh store',async()=>{
    const db=actorDb(owner)
    await run(db,owner,movement('backupmove','place',null,'child'))
    await run(db,owner,{action:'invite',payload:{id:'invite',email:'pending@example.com'}})
    await assertFails(exportFirebaseStore(actorDb(editor),'main'))
    const backup=await exportFirebaseStore(db,'main')
    expect(backup.privateNotes.backupmove).toBe('Private staff note')
    const restored=prepareRecovery(JSON.parse(JSON.stringify(backup)),'recovered','Recovered',iso=>Timestamp.fromDate(new Date(iso)))
    await env.withSecurityRulesDisabled(async ctx=>{
      const admin=ctx.firestore() as unknown as Firestore,batch=writeBatch(admin)
      batch.set(doc(admin,'stores','recovered'),restored.store)
      for(const[t,rows]of Object.entries(restored.records))for(const[id,row]of Object.entries(rows))batch.set(doc(admin,'stores','recovered',t,id),row)
      await batch.commit()
    })
    const result=await exportFirebaseStore(db,'recovered')
    expect(result.snapshot).toEqual({...backup.snapshot,store:{...backup.snapshot.store,id:'recovered',name:'Recovered'}})
    expect(result.firebase.collections).toEqual(backup.firebase.collections)
    expect(()=>prepareRecovery(backup,'main','Oops',s=>s)).toThrow('new store')
    const broken=structuredClone(backup);broken.firebase.collections.locations.a.childCount=99
    expect(()=>prepareRecovery(broken,'bad','Bad',s=>s)).toThrow('counters')
  })
})
