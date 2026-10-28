import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import type { DocumentData, Firestore } from 'firebase/firestore'
import { ConflictError, requireText } from './model.ts'
import type { Request } from './model.ts'
import { groupKey, nameKey, normaliseEmail, validId } from './firebase-schema.ts'
export type Actor = { uid:string; email:string; emailVerified:boolean }
export type ClaimRequest = { action:'claim';payload:{id:string;email:string};requestId:string;expectedRevision:number }
export type FirebaseRequest = Request | ClaimRequest
export function clientSignature(r:FirebaseRequest) { return JSON.stringify({action:r.action,payload:r.payload}) }

// Stage every write until all transaction reads have completed. Firestore rules
// validate this protocol independently; these friendly checks are not security.
export async function applyFirebaseCommand(db:Firestore, storeId:string, r:FirebaseRequest, actor:Actor):Promise<number> {
  validId(storeId);validId(r.requestId)
  if(!actor.emailVerified) throw new Error('Sign in with a verified Google account.')
  const root=doc(db,'stores',storeId), signature=clientSignature(r)
  return runTransaction(db,async tx=>{
    const cache=new Map<string,DocumentData|null>(), writes=new Map<string,DocumentData|null>()
    const ref=(table:string,key:string)=>{
      if(!key || key.includes('/') || key==='.' || key==='..') throw new Error('Invalid record key.')
      return doc(db,'stores',storeId,table,key)
    }
    const read=async(table:string,key:string,required=true):Promise<DocumentData|null>=>{
      const k=`${table}/${key}`
      if(!cache.has(k)){const d=await tx.get(ref(table,key));cache.set(k,d.exists()?d.data():null)}
      const d=cache.get(k)!
      if(required&&!d) throw new Error('This record no longer exists. Refresh the store and review your entry.')
      return d
    }
    const set=(t:string,k:string,data:DocumentData|null)=>writes.set(`${t}/${k}`,data)
    const counter=async(key:string,field:'stockCount'|'childCount',delta:number)=>{
      if(!delta)return
      const before=(await read('locations',key))!, staged=writes.get(`locations/${key}`)??before
      set('locations',key,{...staged,[field]:staged[field]+delta,lastRequest:r.requestId})
    }
    const store=await tx.get(root)
    if(!store.exists())throw new Error('Store not found. Complete Firebase setup before connecting this build.')
    const member=await read('members',actor.uid,false),role=member?.role??'guest'
    if(r.action!=='claim'&&!['owner','editor'].includes(role))throw new Error('Only invited staff can save changes.')
    const previous=await read('commands',r.requestId,false)
    if(previous){
      if(previous.actor!==actor.uid||previous.signature!==signature)throw new Error('This retry ID belongs to a different save.')
      return previous.revision
    }
    if(r.action==='claim'&&member)return store.data().revision
    if(store.data().revision!==r.expectedRevision)throw new ConflictError()
    let p:DocumentData={...r.payload}
    switch(r.action){
      case 'group': {
        validId(p.id);validId(p.brandId);validId(p.categoryId);validId(p.departmentId)
        const b=(await read('brands',p.brandId))!,c=(await read('categories',p.categoryId))!,d=(await read('departments',p.departmentId))!
        if(!b.active||!c.active||!d.active)throw new Error('Choose an active brand, category and department.')
        if(await read('groupKeys',groupKey({brandId:p.brandId,categoryId:p.categoryId,departmentId:p.departmentId}),false))throw new Error('This stock group already exists. Open it to add a location.')
        if(await read('groups',p.id,false))throw new Error('This stock group ID is already in use.')
        set('groups',p.id,{...p,locationIds:[],lastRequest:r.requestId})
        set('groupKeys',groupKey({brandId:p.brandId,categoryId:p.categoryId,departmentId:p.departmentId}),{groupId:p.id,lastRequest:r.requestId});break
      }
      case 'location': {
        validId(p.id);requireText(p.area,'Area');requireText(p.code,'Location code')
        p={...p,area:p.area.trim(),code:p.code.trim().toUpperCase()}
        const old=await read('locations',p.id,false), parent=p.parentId?await read('locations',p.parentId):null
        if(!['Cabinet','Rack','Shelf','Drawer','Room','Wall','Tub','Area'].includes(p.kind))throw new Error('Choose a location type.')
        if(parent&&(parent.parentId||parent.id===p.id||parent.area!==p.area))throw new Error('Choose a standalone storage unit in the same area.')
        if(old?.childCount&&(p.parentId||p.area!==old.area))throw new Error('Remove or relocate child locations before changing this unit’s area or parent.')
        const code=await read('codes',nameKey(p.code),false)
        if(code&&code.locationId!==p.id)throw new Error('That location code is already in use.')
        const oldParent=old?.parentId??null
        if(oldParent!==p.parentId){if(oldParent)await counter(oldParent,'childCount',-1);if(p.parentId)await counter(p.parentId,'childCount',1)}
        if(old&&nameKey(old.code)!==nameKey(p.code))set('codes',nameKey(old.code),null)
        set('codes',nameKey(p.code),{locationId:p.id,lastRequest:r.requestId})
        set('locations',p.id,{...p,stockCount:old?.stockCount??0,childCount:old?.childCount??0,lastRequest:r.requestId});break
      }
      case 'deleteLocation': {
        validId(p.id);const l=(await read('locations',p.id))!
        if(l.stockCount)throw new Error('Move or remove all stock links before deleting this location.')
        if(l.childCount)throw new Error('Remove the drawers or shelves inside this unit first.')
        if(l.parentId)await counter(l.parentId,'childCount',-1)
        set('locations',p.id,null);set('codes',nameKey(l.code),null);break
      }
      case 'taxon': {
        validId(p.id);requireText(p.name,'Name')
        if(!['brands','categories','departments'].includes(p.table))throw new Error('Invalid option type.')
        p={...p,name:p.name.trim()}
        const old=await read(p.table,p.id,false),nk=`${p.table}|${nameKey(p.name)}`,key=await read('uniqueNames',nk,false)
        if(key&&key.entityId!==p.id)throw new Error('That name already exists.')
        if(old&&nameKey(old.name)!==nameKey(p.name))set('uniqueNames',`${p.table}|${nameKey(old.name)}`,null)
        const data=old??(p.table==='brands'?{aliases:[],departments:[],sourcePages:[],retrievedOn:null}:{})
        set(p.table,p.id,{...data,id:p.id,name:p.name,active:p.active,lastRequest:r.requestId})
        set('uniqueNames',nk,{table:p.table,entityId:p.id,lastRequest:r.requestId});break
      }
      case 'movement': {
        validId(p.id);const g=(await read('groups',p.groupId))!,before:string[]=g.locationIds
        const removes=['move','correct','remove'].includes(p.kind),adds=p.kind!=='remove'
        if(!['place','also','move','correct','remove'].includes(p.kind))throw new Error('Choose a movement action.')
        if(removes&&(!p.from||!before.includes(p.from)))throw new Error('The selected source is no longer linked to this stock group.')
        if(!removes&&p.from)throw new Error('An additional location cannot have a source.')
        if(adds&&!p.to)throw new Error('Choose a destination.')
        if(!adds&&p.to)throw new Error('A removal cannot have a destination.')
        if(p.from&&p.from===p.to)throw new Error('Choose a different destination.')
        if(p.kind==='place'&&before.length)throw new Error('Use Also store here for an already placed group.')
        if(p.kind==='also'&&!before.length)throw new Error('Add the first location before adding another.')
        if(adds&&!removes&&before.includes(p.to))throw new Error('This stock group is already at that location.')
        if(['correct','remove'].includes(p.kind))requireText(p.reason,'Correction reason')
        if(p.reason.length>160||p.privateNote.length>2000)throw new Error('The reason or staff note is too long.')
        const address=async(id:string|null)=>{
          if(!id)return null
          const l=(await read('locations',id))!,parent=l.parentId?await read('locations',l.parentId):null
          return `${l.area} → ${parent?`${parent.kind} ${parent.code} → `:''}${l.kind} ${l.code}`
        }
        const fromLabel=await address(p.from),toLabel=await address(p.to)
        const b=(await read('brands',g.brandId))!,c=(await read('categories',g.categoryId))!,d=(await read('departments',g.departmentId))!
        p={...p,reason:p.reason.trim(),privateNote:p.privateNote.trim(),groupLabel:`${b.name} · ${c.name} · ${d.name}`}
        const after=removes?before.filter(id=>id!==p.from):[...before]
        if(adds&&!after.includes(p.to))after.push(p.to)
        if(removes)await counter(p.from,'stockCount',-1)
        if(adds&&!before.includes(p.to))await counter(p.to,'stockCount',1)
        set('groups',p.groupId,{...g,locationIds:after,lastRequest:r.requestId})
        set('movements',p.id,{id:p.id,groupId:p.groupId,kind:p.kind,from:p.from,to:p.to,fromLabel,toLabel,groupLabel:p.groupLabel,reason:p.reason,at:serverTimestamp(),lastRequest:r.requestId});break
      }
      case 'invite': {
        if(role!=='owner')throw new Error('Only the owner can manage staff.')
        p={...p,email:normaliseEmail(p.email)}
        if(await read('invitations',p.email,false)||await read('accessEmails',p.email,false))throw new Error('This person already has access or an invitation.')
        set('invitations',p.email,{email:p.email,role:'editor',invitedBy:actor.uid,at:serverTimestamp(),lastRequest:r.requestId});break
      }
      case 'revoke': {
        if(role!=='owner')throw new Error('Only the owner can manage staff.')
        const split=p.id.indexOf(':'),type=p.id.slice(0,split),key=p.id.slice(split+1)
        if(split<0||!['member','invitation'].includes(type))throw new Error('Invalid staff record.')
        const table=type==='member'?'members':'invitations',target=(await read(table,key))!
        if(target.role==='owner')throw new Error('Owner access cannot be removed here.')
        p={...p,targetType:table,targetKey:key}
        if(table==='members'){await read('accessEmails',target.email);set('accessEmails',target.email,null)}
        set(table,key,null);break
      }
      case 'claim': {
        p={id:actor.uid,email:normaliseEmail(actor.email)}
        const invitation=await read('invitations',p.email,false),access=await read('accessEmails',p.email,false)
        if(!invitation)throw new Error('No store invitation was found for this Google account. Ask the owner to invite this email.')
        if(access)throw new Error('This email already belongs to another store account. Contact the owner.')
        set('members',actor.uid,{uid:actor.uid,email:p.email,role:'editor',lastRequest:r.requestId})
        set('accessEmails',p.email,{uid:actor.uid,role:'editor',lastRequest:r.requestId})
        set('invitations',p.email,null);break
      }
    }
    const revision=r.expectedRevision+1
    tx.set(doc(db,'stores',storeId,'commands',r.requestId),{id:r.requestId,actor:actor.uid,at:serverTimestamp(),expectedRevision:r.expectedRevision,revision,action:r.action,payload:p,signature})
    tx.update(root,{revision,lastRequest:r.requestId})
    for(const [key,data]of writes){const i=key.indexOf('/'),target=ref(key.slice(0,i),key.slice(i+1));if(data===null)tx.delete(target);else tx.set(target,data)}
    return revision
  })
}
