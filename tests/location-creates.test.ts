import { describe, it, expect, vi } from 'vitest'
import { LocationCreates, withPendingLocations, validateLocationCreate } from '../src/lib/location-creates'
import type { LocationCreate } from '../src/lib/location-creates'
import type { Location, Request, Snapshot } from '../src/lib/model'
import { newDemoData, applyDemo } from '../src/lib/demo'

const location = (id: string): Location => ({ id, code: id.toUpperCase(), area: 'Back of House', kind: 'Cabinet', parentId: null })
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes,no) => { resolve=yes; reject=no }); return { promise, resolve, reject } }
describe('optimistic location creates', () => {
  it('shows temporary locations before the network completes and preserves them across refreshes', async () => {
    const base = newDemoData().snapshot, loading = deferred<Snapshot>(), saving = deferred<Snapshot>()
    let jobs: LocationCreate[] = []
    const saved = vi.fn(), snapshot = vi.fn()
    const queue = new LocationCreates({ load: () => loading.promise, save: () => saving.promise, changed: next => { jobs=next }, snapshot, saved })
    queue.add(location('new'), 'editor')
    expect(withPendingLocations(base,jobs)?.locations).toContainEqual(location('new'))
    expect(base.locations).not.toContainEqual(location('new'))
    const refreshed = { ...base, store: { ...base.store, revision: base.store.revision+1 } }
    expect(withPendingLocations(refreshed,jobs)?.locations).toContainEqual(location('new'))
    expect(saved).not.toHaveBeenCalled()
    loading.resolve(refreshed)
    const confirmed = { ...refreshed, locations: [...refreshed.locations,location('new')] }
    saving.resolve(confirmed)
    await vi.waitFor(() => expect(jobs).toEqual([]))
    expect(snapshot).toHaveBeenLastCalledWith(confirmed)
    expect(saved).toHaveBeenCalledOnce()
  })
  it('serialises rapid adds using each latest revision without erasing the second temporary row', async () => {
    let data = newDemoData(), jobs: LocationCreate[] = []
    const first = deferred<Snapshot>(), requests: Request[] = []
    const queue = new LocationCreates({ load: async () => structuredClone(data.snapshot), save: async (r,role) => {
      requests.push(r); data=applyDemo(data,r,role)
      return requests.length === 1 ? first.promise : structuredClone(data.snapshot)
    }, snapshot: () => {}, changed: next => { jobs=next }, saved: () => {} })
    queue.add(location('first'),'editor'); queue.add(location('second'),'editor')
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    expect(jobs.map(j=>j.status)).toEqual(['saving','queued'])
    expect(withPendingLocations(data.snapshot,jobs)?.locations.filter(l=>['first','second'].includes(l.id))).toHaveLength(2)
    first.resolve(structuredClone(data.snapshot))
    await vi.waitFor(() => expect(jobs).toEqual([]))
    expect(requests[1].expectedRevision).toBe(requests[0].expectedRevision+1)
    expect(data.snapshot.locations).toEqual(expect.arrayContaining([location('first'),location('second')]))
  })
  it('rolls back only the failed temporary row, retains its details, and retries an ambiguous save idempotently', async () => {
    let data = newDemoData(), jobs: LocationCreate[] = [], failedOnce=false
    const requests: Request[] = []
    const queue = new LocationCreates({ load: async () => structuredClone(data.snapshot), save: async (r,role) => {
      requests.push(r); data=applyDemo(data,r,role)
      if (!failedOnce) { failedOnce=true; throw new Error('Connection lost after saving') }
      return structuredClone(data.snapshot)
    }, snapshot: () => {}, changed: next => { jobs=next }, saved: () => {} })
    const before = structuredClone(data.snapshot)
    queue.add(location('retry'),'editor')
    await vi.waitFor(() => expect(jobs[0]?.status).toBe('failed'))
    expect(jobs[0].location).toEqual(location('retry'))
    expect(withPendingLocations(before,jobs)).toEqual(before)
    const committedRevision=data.snapshot.store.revision
    queue.retry('retry')
    await vi.waitFor(() => expect(jobs).toEqual([]))
    expect(requests[1].requestId).toBe(requests[0].requestId)
    expect(data.snapshot.store.revision).toBe(committedRevision)
    expect(data.snapshot.locations.filter(l=>l.id==='retry')).toHaveLength(1)
  })
  it('rejects duplicate codes and unsaved parents before displaying a temporary location', () => {
    const base = newDemoData().snapshot
    expect(() => validateLocationCreate(base,{...location('duplicate'),code:base.locations[0].code.toLowerCase()})).toThrow('already in use')
    expect(() => validateLocationCreate(base,{...location('child'),parentId:'unsaved-parent'})).toThrow('saved storage unit')
  })
  it('keeps later successful creates when an earlier create fails, and accepts an edited retry', async () => {
    let data = newDemoData(), jobs: LocationCreate[] = []
    const queue = new LocationCreates({ load: async () => structuredClone(data.snapshot), save: async (r,role) => {
      if (r.action === 'location' && r.payload.code === 'BAD') throw new Error('Rejected location')
      data=applyDemo(data,r,role); return structuredClone(data.snapshot)
    }, snapshot: () => {}, changed: next => { jobs=next }, saved: () => {} })
    queue.add(location('bad'),'editor'); queue.add(location('good'),'editor')
    await vi.waitFor(() => { expect(jobs).toHaveLength(1); expect(jobs[0].status).toBe('failed') })
    expect(data.snapshot.locations).toContainEqual(location('good'))
    expect(withPendingLocations(data.snapshot,jobs)?.locations).not.toContainEqual(location('bad'))
    queue.add({...location('bad'),code:'FIXED'},'editor')
    await vi.waitFor(() => expect(jobs).toEqual([]))
    expect(data.snapshot.locations).toEqual(expect.arrayContaining([location('good'),{...location('bad'),code:'FIXED'}]))
  })
})
