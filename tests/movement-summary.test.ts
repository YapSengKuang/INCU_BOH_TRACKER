import { describe, expect, it } from 'vitest'
import { summarizeMovements } from '../src/lib/movement-summary'
import type { Movement } from '../src/lib/model'
const movement = (at: string, kind: Movement['kind'] = 'move', groupId = 'group'): Movement => ({ id: at, at, kind, groupId, groupLabel: 'Stock', from: null, to: null, fromLabel: null, toLabel: null, reason: '' })
describe('store calendar-day movement summaries', () => {
  it('includes the first local midnight, excludes older and future movements', () => {
    const rows = ['2026-10-25T12:59:59Z', '2026-10-25T13:00:00Z', '2026-10-27T13:00:00Z', '2026-10-28T02:00:01Z'].map(at => movement(at))
    const result = summarizeMovements(rows, 'Australia/Melbourne', 3, new Date('2026-10-28T02:00:00Z'))
    expect(result.daily).toEqual([{ date: '2026-10-26', count: 1 }, { date: '2026-10-27', count: 0 }, { date: '2026-10-28', count: 1 }])
    expect(result.total).toBe(2)
    expect(result.groups).toBe(1)
  })
  it('switches between three and seven calendar days and counts every movement type', () => {
    const rows = (['place', 'also', 'move', 'correct', 'remove'] as const).map((kind, i) => movement(`2026-10-${22 + i}T01:00:00Z`, kind, `group-${i}`))
    expect(summarizeMovements(rows, 'Australia/Melbourne', 3, new Date('2026-10-28T02:00:00Z')).total).toBe(1)
    const week = summarizeMovements(rows, 'Australia/Melbourne', 7, new Date('2026-10-28T02:00:00Z'))
    expect(week.total).toBe(5)
    expect(week.groups).toBe(5)
    expect(Object.values(week.counts)).toEqual([1, 1, 1, 1, 1])
  })
  it.each([
    ['2026-10-04T15:00:00Z', '2026-10-02T14:00:00Z', '2026-10-02T13:59:59Z', '2026-10-03'],
    ['2026-04-05T15:00:00Z', '2026-04-03T13:00:00Z', '2026-04-03T12:59:59Z', '2026-04-04'],
  ])('handles both daylight-saving transitions at %s', (now, included, excluded, firstDay) => {
    const result = summarizeMovements([movement(included), movement(excluded)], 'Australia/Melbourne', 3, new Date(now))
    expect(result.daily[0]).toEqual({ date: firstDay, count: 1 })
    expect(result.total).toBe(1)
  })
  it('uses the store timezone even when its date differs from UTC and crosses a year', () => {
    const result = summarizeMovements([movement('2027-01-01T02:00:00Z')], 'America/Los_Angeles', 3, new Date('2027-01-01T03:00:00Z'))
    expect(result.daily.map(day => day.date)).toEqual(['2026-12-29', '2026-12-30', '2026-12-31'])
    expect(result.daily[2].count).toBe(1)
  })
  it('returns empty days and ignores invalid timestamps', () => {
    const result = summarizeMovements([movement('invalid')], 'Australia/Melbourne', 7, new Date('2026-10-28T02:00:00Z'))
    expect(result.total).toBe(0)
    expect(result.daily).toHaveLength(7)
    expect(result.daily.every(day => day.count === 0)).toBe(true)
  })
})

describe('destination summaries', () => {
  const change = (day: number, kind: Movement['kind'], from: string | null, to: string | null, group = 'caps'): Movement => ({ ...movement(`2026-10-${day}T01:00:00Z`, kind, group), from, to, fromLabel: from, toLabel: to, groupLabel: group })
  const report = (rows: Movement[], days: 3 | 7 = 3) => summarizeMovements(rows, 'Australia/Melbourne', days, new Date('2026-10-28T02:00:00Z')).destinations
  it('groups stock by destination and replaces intermediate stops, regardless of input order', () => {
    const result = report([change(28, 'move', 'Shelf', 'Room'), change(26, 'move', 'Drawer', 'Shelf'), change(27, 'move', 'Rack', 'Room', 'shirts')])
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Room')
    expect(result[0].movements.map(m => m.groupLabel)).toEqual(['caps', 'shirts'])
  })
  it('keeps additional locations when another link moves', () => {
    const result = report([change(26, 'place', null, 'Shelf'), change(27, 'also', null, 'Room'), change(28, 'move', 'Shelf', 'Rack')])
    expect(result.map(d => d.label)).toEqual(['Rack', 'Room'])
  })
  it('shows corrections and removals without claiming a removed link is a destination', () => {
    const result = report([change(26, 'place', null, 'Shelf'), change(27, 'correct', 'Shelf', 'Room'), change(28, 'remove', 'Room', null)])
    expect(result).toHaveLength(1)
    expect(result[0].removed).toBe(true)
    expect(result[0].movements[0].kind).toBe('remove')
  })
  it('clears an earlier removal when a location is added again', () => {
    const result = report([change(26, 'remove', 'Room', null), change(28, 'also', null, 'Room')])
    expect(result).toHaveLength(1)
    expect(result[0].removed).toBe(false)
  })
  it('includes only destinations changed in the selected period', () => {
    const rows = [change(23, 'place', null, 'Room'), change(28, 'also', null, 'Rack')]
    expect(report(rows).map(d => d.label)).toEqual(['Rack'])
    expect(report(rows, 7).map(d => d.label)).toEqual(['Rack', 'Room'])
  })
})
