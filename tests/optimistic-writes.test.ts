import { describe,it,expect,vi } from 'vitest'
import { applyDemo,newDemoData } from '../src/lib/demo'
import { optimisticView, OptimisticWrites, projectWrite, writeOperation, optimisticOperations } from '../src/lib/optimistic-writes'
import type { WriteJob,WriteView } from '../src/lib/optimistic-writes'
import type { Command,Request } from '../src/lib/model'
const deferred=<T>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes});return {promise,resolve}}
function harness(){
  let data=newDemoData(),jobs:WriteJob[]=[],session='one',confirmed:WriteView={snapshot:data.snapshot,staff:data.staff}
  const requests:Request[]=[],gate=deferred<void>()
  let wait=false,ambiguous=false
  const io={session:()=>session,load:async()=>({snapshot:structuredClone(data.snapshot),staff:structuredClone(data.staff)}),save:async(r:Request,role:any)=>{
    requests.push(r);if(wait)await gate.promise
    data=applyDemo(data,r,role)
    if(ambiguous){ambiguous=false;throw new Error('Response lost')}
    return {snapshot:structuredClone(data.snapshot),staff:structuredClone(data.staff)}
  },confirmed:(v:WriteView)=>{confirmed=v},changed:(v:WriteJob[])=>{jobs=v},saved:vi.fn()}
  return {queue:new OptimisticWrites(io),get base(){return confirmed},get jobs(){return jobs},get data(){return data},requests,gate,io,setWait(){wait=true},loseResponse(){ambiguous=true},changeSession(){session='other'}}
}
const add=(id:string):Command=>({action:'location',payload:{id,code:id.toUpperCase(),area:'Back of House',kind:'Cabinet',parentId:null}})
describe('shared optimistic writes',()=>{
  it('projects brands immediately and rolls back only the failed projection',async()=>{
    const h=harness();h.setWait();h.loseResponse()
    const brand=h.base.snapshot.brands.find(b=>!b.active)!
    h.queue.enqueue({action:'taxon',payload:{table:'brands',id:brand.id,name:brand.name,active:true}},'editor',h.base)
    expect(optimisticView(h.base,h.jobs).snapshot.brands.find(b=>b.id===brand.id)?.active).toBe(true)
    expect(h.base.snapshot.brands.find(b=>b.id===brand.id)?.active).toBe(false)
    h.gate.resolve();await vi.waitFor(()=>expect(h.jobs[0].status).toBe('failed'))
    expect(optimisticView(h.base,h.jobs)).toEqual(h.base)
    h.queue.retry(h.jobs[0].id,'editor');await vi.waitFor(()=>expect(h.jobs).toEqual([]))
    expect(h.requests[1]).toEqual(h.requests[0])
    expect(h.data.snapshot.brands.find(b=>b.id===brand.id)?.active).toBe(true)
  })
  it('serialises rapid additions and keeps server revisions outside the UI projection',async()=>{
    const h=harness();h.setWait();h.queue.enqueue(add('one'),'editor',h.base);h.queue.enqueue(add('two'),'editor',h.base)
    expect(optimisticView(h.base,h.jobs).snapshot.locations).toEqual(expect.arrayContaining([(add('one') as any).payload,(add('two') as any).payload]))
    expect(optimisticView(h.base,h.jobs).snapshot.store.revision).toBe(h.base.snapshot.store.revision)
    await vi.waitFor(()=>expect(h.requests).toHaveLength(1));h.gate.resolve()
    await vi.waitFor(()=>expect(h.jobs).toEqual([]))
    expect(h.requests[1].expectedRevision).toBe(h.requests[0].expectedRevision+1)
  })
  it('retains failed details and prevents a retry under another account',async()=>{
    const h=harness();h.loseResponse();h.queue.enqueue(add('retry'),'editor',h.base)
    await vi.waitFor(()=>expect(h.jobs[0].status).toBe('failed'))
    expect(h.jobs[0].command).toEqual(add('retry'));h.changeSession()
    expect(()=>h.queue.retry(h.jobs[0].id,'editor')).toThrow('account')
  })
  it('validates duplicate codes and parent relationships before displaying changes',()=>{
    const h=harness();const existing=h.base.snapshot.locations[0]
    expect(()=>h.queue.enqueue({...add('dup'),payload:{...(add('dup') as any).payload,code:existing.code}},'editor',h.base)).toThrow('already in use')
    expect(()=>h.queue.enqueue({...add('child'),payload:{...(add('child') as any).payload,parentId:'missing'}},'editor',h.base)).toThrow('storage unit')
    expect(h.jobs).toEqual([])
  })
  it('ignores property ordering when comparing a queued edit with fresh data',async()=>{
    const h=harness();const original=h.base.snapshot.locations[0]
    const base={...h.base,snapshot:{...h.base.snapshot,locations:h.base.snapshot.locations.map(l=>l.id===original.id?{code:l.code,id:l.id,parentId:l.parentId,kind:l.kind,area:l.area}:l)}}
    h.queue.enqueue({action:'location',payload:{...original,code:'EDITED'}},'editor',base)
    await vi.waitFor(()=>expect(h.jobs).toEqual([]));expect(h.data.snapshot.locations.find(l=>l.id===original.id)?.code).toBe('EDITED')
  })
  it('includes the first operation and existing location creation in the rollout',()=>{
    const h=harness(),brand=h.base.snapshot.brands.find(b=>!b.active)!
    const c:Command={action:'taxon',payload:{table:'brands',id:brand.id,name:brand.name,active:true}}
    expect(writeOperation(c,h.base.snapshot)).toBe('brand-enable');expect(optimisticOperations.has('brand-enable')).toBe(true)
    expect(optimisticOperations.has('location-create')).toBe(true)
  })
})

function firstPlacement(h:ReturnType<typeof harness>):Command {
  const group=h.base.snapshot.groups[0]
  h.data.snapshot.placements=h.data.snapshot.placements.filter(p=>p.groupId!==group.id)
  return {action:'movement',payload:{id:crypto.randomUUID(),groupId:group.id,kind:'place',from:null,to:h.base.snapshot.locations[0].id,reason:'',privateNote:'Private staff note'}}
}
describe('stock location writes',()=>{
  it('adds the first location and pending history before confirmation without exposing private notes',async()=>{
    const h=harness();h.setWait();const c=firstPlacement(h)
    h.queue.enqueue(c,'editor',h.base)
    const view=optimisticView(h.base,h.jobs)
    expect(view.snapshot.placements).toContainEqual({groupId:(c as any).payload.groupId,locationId:(c as any).payload.to})
    expect(view.snapshot.movements.at(-1)?.id).toBe(c.payload.id)
    expect(JSON.stringify(view)).not.toContain('Private staff note')
    expect(optimisticOperations.has('stock-place')).toBe(true)
    h.gate.resolve();await vi.waitFor(()=>expect(h.jobs).toEqual([]))
  })
})

describe('optimistic stock also',()=>{
  it('updates only the intended link and keeps unrelated stock while saving',async()=>{
    const h=harness();h.setWait()
    const group=h.base.snapshot.groups[0],before=h.base.snapshot.placements.filter(p=>p.groupId===group.id)
    const source=before[0].locationId,to=h.base.snapshot.locations.find(l=>!before.some(p=>p.locationId===l.id))!.id
    const c:Command={action:'movement',payload:{id:crypto.randomUUID(),groupId:group.id,kind:'also',from:null,to:to,reason:'Verified correction',privateNote:'Hidden note'}}
    h.queue.enqueue(c,'editor',h.base)
    const projected=optimisticView(h.base,h.jobs).snapshot
    expect(projected.placements.filter(p=>p.groupId!==group.id)).toEqual(h.base.snapshot.placements.filter(p=>p.groupId!==group.id))
    expect(projected.placements.some(p=>p.groupId===group.id&&p.locationId===source)).toBe(true)
    expect(projected.placements.some(p=>p.groupId===group.id&&p.locationId===to)).toBe(true)
    expect(projected.movements.at(-1)?.kind).toBe('also')
    expect(JSON.stringify(projected)).not.toContain('Hidden note')
    expect(optimisticOperations.has('stock-also')).toBe(true)
    h.gate.resolve();await vi.waitFor(()=>expect(h.jobs).toEqual([]))
    expect(h.data.snapshot.placements).toEqual(projected.placements)
  })
})

describe('optimistic stock move',()=>{
  it('updates only the intended link and keeps unrelated stock while saving',async()=>{
    const h=harness();h.setWait()
    const group=h.base.snapshot.groups[0],before=h.base.snapshot.placements.filter(p=>p.groupId===group.id)
    const source=before[0].locationId,to=h.base.snapshot.locations.find(l=>!before.some(p=>p.locationId===l.id))!.id
    const c:Command={action:'movement',payload:{id:crypto.randomUUID(),groupId:group.id,kind:'move',from:source,to:to,reason:'Verified correction',privateNote:'Hidden note'}}
    h.queue.enqueue(c,'editor',h.base)
    const projected=optimisticView(h.base,h.jobs).snapshot
    expect(projected.placements.filter(p=>p.groupId!==group.id)).toEqual(h.base.snapshot.placements.filter(p=>p.groupId!==group.id))
    expect(projected.placements.some(p=>p.groupId===group.id&&p.locationId===source)).toBe(false)
    expect(projected.placements.some(p=>p.groupId===group.id&&p.locationId===to)).toBe(true)
    expect(projected.movements.at(-1)?.kind).toBe('move')
    expect(JSON.stringify(projected)).not.toContain('Hidden note')
    expect(optimisticOperations.has('stock-move')).toBe(true)
    h.gate.resolve();await vi.waitFor(()=>expect(h.jobs).toEqual([]))
    expect(h.data.snapshot.placements).toEqual(projected.placements)
  })
})

describe('optimistic stock correct',()=>{
  it('updates only the intended link and keeps unrelated stock while saving',async()=>{
    const h=harness();h.setWait()
    const group=h.base.snapshot.groups[0],before=h.base.snapshot.placements.filter(p=>p.groupId===group.id)
    const source=before[0].locationId,to=h.base.snapshot.locations.find(l=>!before.some(p=>p.locationId===l.id))!.id
    const c:Command={action:'movement',payload:{id:crypto.randomUUID(),groupId:group.id,kind:'correct',from:source,to:to,reason:'Verified correction',privateNote:'Hidden note'}}
    h.queue.enqueue(c,'editor',h.base)
    const projected=optimisticView(h.base,h.jobs).snapshot
    expect(projected.placements.filter(p=>p.groupId!==group.id)).toEqual(h.base.snapshot.placements.filter(p=>p.groupId!==group.id))
    expect(projected.placements.some(p=>p.groupId===group.id&&p.locationId===source)).toBe(false)
    expect(projected.placements.some(p=>p.groupId===group.id&&p.locationId===to)).toBe(true)
    expect(projected.movements.at(-1)?.kind).toBe('correct')
    expect(JSON.stringify(projected)).not.toContain('Hidden note')
    expect(optimisticOperations.has('stock-correct')).toBe(true)
    h.gate.resolve();await vi.waitFor(()=>expect(h.jobs).toEqual([]))
    expect(h.data.snapshot.placements).toEqual(projected.placements)
  })
})

describe('optimistic stock remove',()=>{
  it('updates only the intended link and keeps unrelated stock while saving',async()=>{
    const h=harness();h.setWait()
    const group=h.base.snapshot.groups[0],before=h.base.snapshot.placements.filter(p=>p.groupId===group.id)
    const source=before[0].locationId,to=h.base.snapshot.locations.find(l=>!before.some(p=>p.locationId===l.id))!.id
    const c:Command={action:'movement',payload:{id:crypto.randomUUID(),groupId:group.id,kind:'remove',from:source,to:null,reason:'Verified correction',privateNote:'Hidden note'}}
    h.queue.enqueue(c,'editor',h.base)
    const projected=optimisticView(h.base,h.jobs).snapshot
    expect(projected.placements.filter(p=>p.groupId!==group.id)).toEqual(h.base.snapshot.placements.filter(p=>p.groupId!==group.id))
    expect(projected.placements.some(p=>p.groupId===group.id&&p.locationId===source)).toBe(false)
    expect(projected.placements.filter(p=>p.groupId===group.id)).toHaveLength(before.length-1)
    expect(projected.movements.at(-1)?.kind).toBe('remove')
    expect(JSON.stringify(projected)).not.toContain('Hidden note')
    expect(optimisticOperations.has('stock-remove')).toBe(true)
    h.gate.resolve();await vi.waitFor(()=>expect(h.jobs).toEqual([]))
    expect(h.data.snapshot.placements).toEqual(projected.placements)
  })
})

describe('optimistic stock group creation',()=>{
  it('chains a group behind an unconfirmed brand and selects it before server confirmation',async()=>{
    const h=harness();h.setWait();const brand=h.base.snapshot.brands.find(b=>!b.active)!
    h.queue.enqueue({action:'taxon',payload:{table:'brands',id:brand.id,name:brand.name,active:true}},'editor',h.base)
    const group={id:'new-group',brandId:brand.id,categoryId:h.base.snapshot.categories[0].id,departmentId:h.base.snapshot.departments[0].id}
    h.queue.enqueue({action:'group',payload:group},'editor',h.base)
    expect(optimisticView(h.base,h.jobs).snapshot.groups).toContainEqual(group)
    expect(h.base.snapshot.groups).not.toContainEqual(group)
    expect(optimisticOperations.has('group')).toBe(true)
    h.gate.resolve();await vi.waitFor(()=>expect(h.jobs).toEqual([]))
    expect(h.data.snapshot.groups).toContainEqual(group)
  })
})

describe('optimistic storage location edits',()=>{
  it('updates the visible address immediately and blocks overwriting a newer remote edit',async()=>{
    const h=harness(),original=h.base.snapshot.locations[0],base=structuredClone(h.base)
    const command:Command={action:'location',payload:{...original,code:'MY-EDIT'}}
    h.io.load=async()=>{
      h.data.snapshot.locations=h.data.snapshot.locations.map(l=>l.id===original.id?{...l,code:'REMOTE-EDIT'}:l)
      return {snapshot:structuredClone(h.data.snapshot),staff:structuredClone(h.data.staff)}
    }
    h.queue.enqueue(command,'editor',base)
    expect(optimisticView(base,h.jobs).snapshot.locations.find(l=>l.id===original.id)?.code).toBe('MY-EDIT')
    await vi.waitFor(()=>expect(h.jobs[0]?.status).toBe('failed'))
    expect(h.requests).toHaveLength(0)
    expect(optimisticView(h.base,h.jobs).snapshot.locations.find(l=>l.id===original.id)?.code).toBe('REMOTE-EDIT')
    expect(optimisticOperations.has('location-edit')).toBe(true)
  })
})

describe('optimistic storage location deletion',()=>{
  it('removes only an empty location immediately and restores it if the server rejects deletion',async()=>{
    const h=harness(),s=h.base.snapshot
    const empty=s.locations.find(l=>!s.placements.some(p=>p.locationId===l.id)&&!s.locations.some(c=>c.parentId===l.id))!
    h.io.save=async()=>{throw new Error('Permission revoked')}
    h.queue.enqueue({action:'deleteLocation',payload:{id:empty.id}},'editor',h.base)
    expect(optimisticView(h.base,h.jobs).snapshot.locations.some(l=>l.id===empty.id)).toBe(false)
    await vi.waitFor(()=>expect(h.jobs[0]?.status).toBe('failed'))
    expect(optimisticView(h.base,h.jobs).snapshot.locations).toEqual(h.base.snapshot.locations)
    const occupied=s.placements[0].locationId
    expect(()=>h.queue.enqueue({action:'deleteLocation',payload:{id:occupied}},'editor',h.base)).toThrow('stock links')
    expect(optimisticOperations.has('deleteLocation')).toBe(true)
  })
})

describe('optimistic brands create',()=>{
  it('changes the option immediately while preserving stock groups and unrelated directory data',async()=>{
    const h=harness();h.setWait();const table='brands' as const
    const item={id:'new-'+table,name:'New store option',active:true}
    h.queue.enqueue({action:'taxon',payload:{...item,table}},'editor',h.base)
    const projected=optimisticView(h.base,h.jobs)
    expect(projected.snapshot[table].find(x=>x.id===item.id)).toMatchObject(item)
    expect(projected.snapshot.groups).toEqual(h.base.snapshot.groups)
    expect(projected.snapshot.placements).toEqual(h.base.snapshot.placements)
    expect(h.base.snapshot[table].find(x=>x.id===item.id)?.name).not.toBe(item.name)
    expect(optimisticOperations.has('brands-create')).toBe(true)
    h.gate.resolve();await vi.waitFor(()=>expect(h.jobs).toEqual([]))
    expect(h.data.snapshot[table].find(x=>x.id===item.id)).toMatchObject(item)
  })
})

describe('optimistic brands edit',()=>{
  it('changes the option immediately while preserving stock groups and unrelated directory data',async()=>{
    const h=harness();h.setWait();const table='brands' as const
    const old=h.base.snapshot[table][0],item={id:old.id,name:'Renamed '+old.name,active:false}
    h.queue.enqueue({action:'taxon',payload:{...item,table}},'editor',h.base)
    const projected=optimisticView(h.base,h.jobs)
    expect(projected.snapshot[table].find(x=>x.id===item.id)).toMatchObject(item)
    expect(projected.snapshot.groups).toEqual(h.base.snapshot.groups)
    expect(projected.snapshot.placements).toEqual(h.base.snapshot.placements)
    expect(h.base.snapshot[table].find(x=>x.id===item.id)?.name).not.toBe(item.name)
    expect(optimisticOperations.has('brands-edit')).toBe(true)
    h.gate.resolve();await vi.waitFor(()=>expect(h.jobs).toEqual([]))
    expect(h.data.snapshot[table].find(x=>x.id===item.id)).toMatchObject(item)
  })
})
