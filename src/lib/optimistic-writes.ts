import { applyDemo } from './demo'
import type { Command, Request, Role, Snapshot, Staff } from './model'

export type WriteView = { snapshot: Snapshot; staff: Staff[] }
export type WriteJob = {
  id: string; command: Command; role: Role; session: string; label: string; createdAt: string
  before: string; status: 'queued' | 'saving' | 'failed'; error?: string; request?: Request
}
export function writeOperation(c: Command, s: Snapshot): string {
  const p=c.payload
  switch(c.action) {
    case 'taxon': {
      const old=s[c.payload.table].find(x=>x.id===p.id)
      if(c.payload.table==='brands' && old && !old.active && c.payload.active && old.name===c.payload.name) return 'brand-enable'
      return `${c.payload.table}-${old?'edit':'create'}`
    }
    case 'location': return s.locations.some(x=>x.id===p.id)?'location-edit':'location-create'
    case 'movement': return `stock-${c.payload.kind}`
    default: return c.action
  }
}
// Each operation is enabled in its own implementation commit; this list is also
// the executable counterpart of Documentation/database-writes.md.
export const optimisticOperations = new Set([
  'stock-also',
  'stock-move',
  'stock-correct',
  'stock-remove',
  'group',
  'location-edit',
  'deleteLocation',
  'brands-create',
  'brands-edit',
  'categories-create',
  'categories-edit',
  'departments-create',
  'departments-edit',
  'invite',
  'revoke',
  'brand-enable', 'location-create', 'stock-place',
])
export function writeKey(c: Command) { return `${c.action}:${c.action==='taxon'?c.payload.table+':':''}${c.payload.id}` }
export function writeLabel(c: Command, s: Snapshot, staff:Staff[]=[]) {
  switch(c.action) {
    case 'taxon': return `${s[c.payload.table].some(x=>x.id===c.payload.id)?'Update':'Add'} ${c.payload.table==='brands'?'brand':c.payload.table==='categories'?'category':'department'}: ${c.payload.name}`
    case 'location': return `${s.locations.some(x=>x.id===c.payload.id)?'Edit':'Add'} location ${c.payload.code}`
    case 'deleteLocation': return `Delete location ${s.locations.find(x=>x.id===c.payload.id)?.code??c.payload.id}`
    case 'group': return 'Create stock group'
    case 'movement': return ({place:'Add first stock location',also:'Add another stock location',move:'Move stock',correct:'Correct stock location',remove:'Remove stock location'})[c.payload.kind]
    case 'invite': return `Invite ${c.payload.email}`
    case 'revoke': return `Remove access for ${staff.find(p=>p.id===c.payload.id)?.email??'staff member'}`
  }
}
function stable(value:unknown):string { return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item) }
export function writeTarget(view: WriteView, c: Command): string {
  // Compare edited records before refreshing the revision. A concurrent edit to
  // this record needs review, while unrelated records can safely move forward.
  switch(c.action) {
    case 'taxon': return stable(view.snapshot[c.payload.table].find(x=>x.id===c.payload.id)??null)
    case 'location': case 'deleteLocation': return stable(view.snapshot.locations.find(x=>x.id===c.payload.id)??null)
    case 'revoke': return stable(view.staff.find(x=>x.id===c.payload.id)??null)
    default: return '' // Creations/movements are validated against latest relationships.
  }
}
function fulfilled(view: WriteView, c: Command) {
  const s=view.snapshot
  switch(c.action) {
    case 'group': return s.groups.some(x=>x.id===c.payload.id)
    case 'movement': return s.movements.some(x=>x.id===c.payload.id)
    case 'location': return s.locations.some(x=>x.id===c.payload.id&&x.code===c.payload.code&&x.area===c.payload.area&&x.kind===c.payload.kind&&x.parentId===c.payload.parentId)
    case 'deleteLocation': return !s.locations.some(x=>x.id===c.payload.id)
    case 'taxon': return s[c.payload.table].some(x=>x.id===c.payload.id&&x.name===c.payload.name.trim()&&x.active===c.payload.active)
    case 'invite': return view.staff.some(x=>x.email===c.payload.email.trim().toLowerCase())
    case 'revoke': return !view.staff.some(x=>x.id===c.payload.id)
  }
}
export function projectWrite(view: WriteView, command: Command, role: Role, id: string, at: string): WriteView {
  const data=applyDemo({snapshot:view.snapshot,staff:view.staff,receipts:{},privateNotes:{}},{...command,requestId:id,expectedRevision:view.snapshot.store.revision},role)
  data.snapshot.store.revision=view.snapshot.store.revision // Never invent a server revision.
  if(command.action==='movement') data.snapshot.movements.find(m=>m.id===command.payload.id)!.at=at
  return {snapshot:data.snapshot,staff:data.staff}
}
export function optimisticView(base: WriteView, jobs: WriteJob[]): WriteView {
  let view=base
  for(const job of jobs) {
    if(job.status==='failed'||fulfilled(view,job.command)) continue
    try {view=projectWrite(view,job.command,job.role,job.id,job.createdAt)} catch { /* A dependent job will fail validation in the queue; don't invent invalid records. */ }
  }
  return view
}
export class OptimisticWrites {
  jobs: WriteJob[]=[]
  private running=false
  constructor(private io:{load:(role:Role)=>Promise<WriteView>;save:(r:Request,role:Role)=>Promise<WriteView>;session:()=>string;confirmed:(view:WriteView)=>void;changed:(jobs:WriteJob[])=>void;saved:(label:string)=>void}){}
  private publish(){this.io.changed(this.jobs.map(j=>({...j})))}
  enqueue(command:Command,role:Role,base:WriteView) {
    if(role==='guest') throw new Error('Only invited staff can save changes.')
    const key=writeKey(command)
    // Don't submit the same entity twice while its request is in flight.
    if(this.jobs.some(j=>writeKey(j.command)===key&&j.status!=='failed')) throw new Error('This change is still saving. Try again after it finishes.')
    const retained=this.jobs.filter(j=>writeKey(j.command)!==key||j.status!=='failed')
    const view=optimisticView(base,retained), id=crypto.randomUUID(), createdAt=new Date().toISOString()
    projectWrite(view,command,role,id,createdAt) // Local validation before closing the form.
    const job:WriteJob={id,command:structuredClone(command),role,session:this.io.session(),label:writeLabel(command,view.snapshot,view.staff),createdAt,before:writeTarget(view,command),status:'queued'}
    this.jobs=[...retained,job];this.publish();void this.drain()
  }
  retry(id:string,role:Role) {
    const job=this.jobs.find(j=>j.id===id&&j.status==='failed')
    if(!job)return
    if(role==='guest'||job.session!==this.io.session()) throw new Error('Sign in with the account that made this change.')
    job.role=role;job.status='queued';job.error=undefined;this.publish();void this.drain()
  }
  dismiss(id:string){this.jobs=this.jobs.filter(j=>j.id!==id||j.status!=='failed');this.publish()}
  private async drain(){
    if(this.running)return
    this.running=true
    try {
      let job:WriteJob|undefined
      while((job=this.jobs.find(j=>j.status==='queued'))){
        job.status='saving';this.publish()
        try {
          if(job.session!==this.io.session())throw new Error('The signed-in account changed. Sign in with the original account to retry.')
          if(!job.request){
            const latest=await this.io.load(job.role)
            if(job.session!==this.io.session())throw new Error('The signed-in account changed.')
            this.io.confirmed(latest)
            if(writeTarget(latest,job.command)!==job.before)throw new Error('This record changed while your request was waiting. Review its latest values before saving again.')
            projectWrite(latest,job.command,job.role,job.id,job.createdAt)
            job.request={...job.command,requestId:job.id,expectedRevision:latest.snapshot.store.revision}
          }
          // Retries keep the exact request and revision: receipts confirm an
          // already committed write, and stale uncommitted edits are rejected.
          const confirmed=await this.io.save(job.request,job.role)
          if(job.session!==this.io.session())throw new Error('The signed-in account changed.')
          this.io.confirmed(confirmed)
          this.jobs=this.jobs.filter(j=>j!==job);this.io.saved(job.label)
        }catch(e){job.status='failed';job.error=e instanceof Error?e.message:'Could not confirm this change.'}
        this.publish()
      }
    }finally{this.running=false}
  }
}
