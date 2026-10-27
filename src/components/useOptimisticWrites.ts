import { useEffect, useRef, useState } from 'react'
import { loadSnapshot, loadStaff, save, writeSession } from '../lib/api'
import { OptimisticWrites } from '../lib/optimistic-writes'
import type { WriteJob, WriteView } from '../lib/optimistic-writes'
export function useOptimisticWrites(onConfirmed:(view:WriteView)=>void,onSaved:(label:string)=>void){
  const [jobs,setJobs]=useState<WriteJob[]>([]),callbacks=useRef({onConfirmed,onSaved})
  callbacks.current={onConfirmed,onSaved}
  const [queue]=useState(()=>new OptimisticWrites({
    session:writeSession,load:async role=>({snapshot:await loadSnapshot(),staff:await loadStaff(role)}),
    save:async(r,role)=>({snapshot:await save(r,role),staff:await loadStaff(role)}),
    confirmed:v=>callbacks.current.onConfirmed(v),changed:setJobs,saved:label=>callbacks.current.onSaved(label),
  }))
  const saving=jobs.some(j=>j.status!=='failed')
  useEffect(()=>{
    if(!saving)return
    const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
    window.addEventListener('beforeunload',beforeUnload)
    return()=>window.removeEventListener('beforeunload',beforeUnload)
  },[saving])
  return {jobs,queue,saving}
}
