import type { Movement, MoveKind } from './model'

export const movementLabels: Record<MoveKind, string> = {
  place: 'First placements', also: 'Additional locations', move: 'Moves',
  correct: 'Corrections', remove: 'Location removals',
}

export function summarizeMovements(movements: Movement[], timezone: string, days: 3 | 7, now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const dateKey = (date: Date) => {
    const parts = formatter.formatToParts(date)
    return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-')
  }
  const today = dateKey(now)
  // UTC arithmetic here walks calendar labels, not elapsed hours in the store.
  // This keeps 23-hour and 25-hour daylight-saving days intact.
  const calendar = new Date(`${today}T00:00:00Z`)
  const daily = Array.from({ length: days }, (_, index) => {
    const day = new Date(calendar)
    day.setUTCDate(day.getUTCDate() - (days - 1 - index))
    return { date: day.toISOString().slice(0, 10), count: 0 }
  })
  const counts: Record<MoveKind, number> = { place: 0, also: 0, move: 0, correct: 0, remove: 0 }
  const groups = new Set<string>()
  const recorded: Movement[] = []
  let total = 0
  for (const movement of movements) {
    const at = new Date(movement.at)
    if (!Number.isFinite(at.getTime()) || at > now) continue
    const bucket = daily.find(day => day.date === dateKey(at))
    if (!bucket) continue
    recorded.push(movement)
    bucket.count++; counts[movement.kind]++; total++; groups.add(movement.groupId)
  }
  return { daily, counts, total, groups: groups.size, destinations: summarizeDestinations(recorded) }
}

export function calendarLabel(date: string) {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

// Replay changes in order: a later move/correction/removal supersedes an
// earlier arrival at that link, while additional storage locations are kept.
export function summarizeDestinations(movements: Movement[]) {
  const arrivals = new Map<string, Movement>()
  const removals = new Map<string, Movement>()
  const key = (group: string, location: string) => JSON.stringify([group, location])
  for (const movement of [...movements].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    if (movement.from && ['move', 'correct', 'remove'].includes(movement.kind)) {
      arrivals.delete(key(movement.groupId, movement.from))
      if (movement.kind === 'remove') removals.set(key(movement.groupId, movement.from), movement)
    }
    if (movement.to && movement.kind !== 'remove') {
      arrivals.set(key(movement.groupId, movement.to), movement)
      removals.delete(key(movement.groupId, movement.to))
    }
  }
  const destinations = new Map<string, { id: string; label: string; removed: boolean; movements: Movement[] }>()
  for (const [removed, rows] of [[false, arrivals], [true, removals]] as const) {
    for (const movement of rows.values()) {
      const id = (removed ? movement.from : movement.to)!
      const groupKey = JSON.stringify([removed, id])
      const destination = destinations.get(groupKey) ?? { id, label: (removed ? movement.fromLabel : movement.toLabel) ?? 'Unnamed location', removed, movements: [] }
      destination.movements.push(movement)
      destinations.set(groupKey, destination)
    }
  }
  return [...destinations.values()].sort((a, b) => Number(a.removed) - Number(b.removed) || a.label.localeCompare(b.label)).map(destination => ({
    ...destination, movements: destination.movements.sort((a, b) => a.groupLabel.localeCompare(b.groupLabel)),
  }))
}
