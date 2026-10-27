import { useEffect, useRef, useState } from 'react'
import type { Snapshot, Location } from '../lib/model'
import { loadSnapshot, save } from '../lib/api'
import { LocationCreates } from '../lib/location-creates'
import type { LocationCreate } from '../lib/location-creates'

export function useLocationCreates(onSnapshot: (s: Snapshot) => void, onSaved: (location: Location) => void) {
  const [jobs, setJobs] = useState<LocationCreate[]>([])
  const callbacks = useRef({ onSnapshot, onSaved })
  callbacks.current = { onSnapshot, onSaved }
  const [queue] = useState(() => new LocationCreates({ load: loadSnapshot, save, changed: setJobs, snapshot: s => callbacks.current.onSnapshot(s), saved: l => callbacks.current.onSaved(l) }))
  const saving = jobs.some(j => j.status !== 'failed')
  useEffect(() => {
    if (!saving) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [saving])
  return { jobs, queue, saving }
}
