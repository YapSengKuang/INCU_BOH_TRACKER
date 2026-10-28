import type { Command, Snapshot } from './model'

export function locationDeletionMessage(s:Snapshot,id:string):string {
  const location=s.locations.find(l=>l.id===id)
  if(!location)return 'This location no longer exists.'
  if(s.locations.some(l=>l.parentId===id))return `Delete ${location.kind} ${location.code}? Remove or relocate its child locations first.`
  const count=s.placements.filter(p=>p.locationId===id).length
  return `Are you sure you want to delete ${location.kind} ${location.code}? ${count?`${count} stock group${count===1?'':'s'} will be unassigned from this location. Groups with no other locations will show “No location saved”. Other assigned locations will be kept. `:''}Brands, stock groups and earlier history will be kept.`
}

// Use the existing audited removal and deletion transactions. The final delete
// still requires an empty location, including after any failed or competing save.
export function locationDeletionCommands(s:Snapshot,id:string):Command[] {
  if(!s.locations.some(l=>l.id===id))throw new Error('This location no longer exists.')
  if(s.locations.some(l=>l.parentId===id))throw new Error('Remove or relocate the drawers or shelves inside this unit first.')
  return [
    ...s.placements.filter(p=>p.locationId===id).map((p):Command=>({action:'movement',payload:{id:crypto.randomUUID(),groupId:p.groupId,kind:'remove',from:id,to:null,reason:'Storage location deleted',privateNote:''}})),
    {action:'deleteLocation',payload:{id}},
  ]
}
