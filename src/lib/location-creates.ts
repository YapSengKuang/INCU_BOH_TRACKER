import type { Location, Request, Role, Snapshot } from './model'
import { requireText } from './model'

export type LocationCreate = { location: Location; role: Role; requestId: string; status: 'queued' | 'saving' | 'failed'; error?: string }
export function validateLocationCreate(s: Snapshot, location: Location) {
  requireText(location.area, 'Area'); requireText(location.code, 'Location code')
  if (s.locations.some(l => l.id !== location.id && l.code.toLowerCase() === location.code.toLowerCase())) throw new Error('That location code is already in use.')
  if (location.parentId && !s.locations.some(l => l.id === location.parentId && !l.parentId && l.area === location.area)) throw new Error('Choose a saved storage unit in the same area.')
}
export function withPendingLocations(s: Snapshot | null, jobs: LocationCreate[]): Snapshot | null {
  if (!s) return null
  return { ...s, locations: [...s.locations, ...jobs.filter(j => j.status !== 'failed' && !s.locations.some(l => l.id === j.location.id)).map(j => j.location)] }
}

// Serialise creates against the store-wide revision, while keeping temporary
// rows separate from confirmed data. Refreshes cannot erase pending entries,
// and a failed create cannot roll back someone else's successful changes.
export class LocationCreates {
  jobs: LocationCreate[] = []
  private running = false
  constructor(private io: {
    load: () => Promise<Snapshot>; save: (r: Request, role: Role) => Promise<Snapshot>
    snapshot: (s: Snapshot) => void; changed: (jobs: LocationCreate[]) => void; saved: (location: Location) => void
  }) {}
  private publish() { this.io.changed(this.jobs.map(j => ({ ...j }))) }
  add(location: Location, role: Role) {
    if (role === 'guest') throw new Error('Only invited staff can add locations.')
    if (this.jobs.some(j => j.location.id === location.id && j.status !== 'failed')) return
    this.jobs = this.jobs.filter(j => j.location.id !== location.id)
    this.jobs.push({ location, role, requestId: crypto.randomUUID(), status: 'queued' })
    this.publish(); void this.drain()
  }
  retry(id: string) {
    const job = this.jobs.find(j => j.location.id === id && j.status === 'failed')
    if (job) { job.status = 'queued'; job.error = undefined; this.publish(); void this.drain() }
  }
  dismiss(id: string) { this.jobs = this.jobs.filter(j => j.location.id !== id || j.status !== 'failed'); this.publish() }
  private async drain() {
    if (this.running) return
    this.running = true
    try {
      let job: LocationCreate | undefined
      while ((job = this.jobs.find(j => j.status === 'queued'))) {
        job.status = 'saving'; this.publish()
        try {
          const latest = await this.io.load()
          this.io.snapshot(latest)
          // An ambiguous previous save may already have committed. Reusing its
          // request ID lets the backend receipt confirm it without another write.
          if (!latest.locations.some(l => l.id === job!.location.id)) validateLocationCreate(latest, job.location)
          const saved = await this.io.save({ action: 'location', payload: job.location, requestId: job.requestId, expectedRevision: latest.store.revision }, job.role)
          this.io.snapshot(saved)
          this.jobs = this.jobs.filter(j => j !== job)
          this.io.saved(job.location)
        } catch (e) {
          job.status = 'failed'; job.error = e instanceof Error ? e.message : 'Could not save this location.'
        }
        this.publish()
      }
    } finally { this.running = false }
  }
}
