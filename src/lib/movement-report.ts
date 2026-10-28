import type { MoveKind, Snapshot } from './model'
import { calendarLabel, summarizeMovements } from './movement-summary'

export const movementActionLabels: Record<MoveKind, string> = { place: 'First placed here', also: 'Also stored here', move: 'Moved here', correct: 'Location corrected', remove: 'Location link removed' }
export type ReportEntry = { id: string; destination: string; stock: string; action: string; from: string; reason: string; at: string }
export type ReportBrand = { id: string; name: string; entries: ReportEntry[] }
export type MovementReport = { store: string; timezone: string; days: 3 | 7; start: string; end: string; generated: string; brands: ReportBrand[] }

export function createMovementReport(snapshot: Snapshot, days: 3 | 7, now = new Date()): MovementReport {
  const summary = summarizeMovements(snapshot.movements, snapshot.store.timezone, days, now)
  const brands = new Map<string, ReportBrand>()
  for (const destination of summary.destinations) {
    if (destination.removed) continue
    for (const movement of destination.movements) {
      const group = snapshot.groups.find(group => group.id === movement.groupId)
      const brand = snapshot.brands.find(brand => brand.id === group?.brandId)
      const id = brand?.id ?? movement.groupId
      const card = brands.get(id) ?? { id, name: brand?.name ?? movement.groupLabel, entries: [] }
      const stock = group ? [snapshot.categories.find(category => category.id === group.categoryId)?.name, snapshot.departments.find(department => department.id === group.departmentId)?.name].filter(Boolean).join(' · ') : ''
      card.entries.push({ id: movement.id, destination: destination.label, stock, action: movementActionLabels[movement.kind], from: movement.fromLabel ?? '', reason: movement.reason, at: movement.at })
      brands.set(id, card)
    }
  }
  return { store: snapshot.store.name, timezone: snapshot.store.timezone, days, start: summary.daily[0].date, end: summary.daily.at(-1)!.date, generated: now.toISOString(), brands: [...brands.values()].sort((a, b) => a.name.localeCompare(b.name)) }
}
export function reportDate(at: string, timezone: string) {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(at))
}
export function reportPeriod(report: MovementReport) { return `${calendarLabel(report.start)} - ${calendarLabel(report.end)}` }
