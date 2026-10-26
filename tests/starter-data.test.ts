import { describe, it, expect } from 'vitest'
import { createSample } from '../src/lib/sample'
import { readBackup, searchGroups } from '../src/lib/model'
import backup from '../public/starter-backup.json'

describe('store starter data', () => {
  it('round-trips the downloadable backup and matches fresh workspaces', () => {
    expect(readBackup(backup).snapshot).toEqual(createSample())
  })
  it('includes all areas and the stated cabinet and fitting room counts', () => {
    const s = createSample()
    expect(new Set(s.locations.map(l => l.area)).size).toBe(21)
    expect(s.locations.filter(l => l.parentId === 'shoe-drawers')).toHaveLength(4)
    expect(s.locations.filter(l => l.parentId === 'pos')).toHaveLength(4)
    expect(s.locations.filter(l => l.parentId === 'mens-fits')).toHaveLength(2)
    expect(s.placements.filter(p => p.locationId === 'mens-fits')).toHaveLength(3)
    expect(s.placements.some(p => p.locationId.startsWith('mens-fitting-room-'))).toBe(false)
  })
  it('finds the recent placements using brand, category and storage words', () => {
    const s = createSample()
    expect(searchGroups(s, 'incu women tops tubs below')).toHaveLength(1)
    expect(searchGroups(s, 'incu men t-shirts tubs below')).toHaveLength(1)
    expect(searchGroups(s, 'ader hats shoe')).toHaveLength(1)
    expect(searchGroups(s, 'ader jackets fits')).toHaveLength(1)
    expect(searchGroups(s, 'patagonia fits')).toHaveLength(2)
    expect(s.groups.every(g => s.brands.some(b => b.id === g.brandId && b.active))).toBe(true)
    expect(s.groups.filter(g => g.departmentId === 'unspecified')).toHaveLength(4)
  })
})
