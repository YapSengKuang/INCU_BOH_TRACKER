import { describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { createSample } from '../src/lib/sample'
import { createMovementReport } from '../src/lib/movement-report'
import { createReportPdf } from '../src/lib/movement-report-pdf'
const now = new Date('2026-10-28T02:00:00Z')
const font = readFileSync(new URL('../public/fonts/Geist-Variable.ttf', import.meta.url)).toString('base64')

describe('movement report exports', () => {
  it('freezes the selected period, public fields and generation time independently of later data changes', () => {
    const snapshot = createSample()
    const report = createMovementReport(snapshot, 3, now)
    const original = structuredClone(report)
    expect(report.start).toBe('2026-10-26')
    expect(report.end).toBe('2026-10-28')
    expect(report.generated).toBe(now.toISOString())
    expect(report.brands.length).toBeGreaterThan(0)
    snapshot.movements[0].toLabel = 'Changed later'
    snapshot.brands.forEach(brand => { brand.name = 'Renamed later' })
    expect(report).toEqual(original)
    expect(Object.keys(report)).toEqual(['store', 'timezone', 'days', 'start', 'end', 'generated', 'brands'])
  })
  it('omits removals and destinations that a later move superseded', () => {
    const snapshot = createSample()
    const first = snapshot.movements[0]
    snapshot.movements = [first, { ...first, id: 'remove', kind: 'remove', from: first.to, fromLabel: first.toLabel, to: null, toLabel: null, at: '2026-10-27T00:00:00Z' }]
    expect(createMovementReport(snapshot, 3, now).brands).toEqual([])
  })
  it('creates an empty PDF and paginates long names and destinations with an embedded Unicode font', () => {
    const snapshot = createSample()
    snapshot.movements = []
    const empty = createMovementReport(snapshot, 7, now)
    expect(createReportPdf(empty, font).getNumberOfPages()).toBe(1)
    const report = createMovementReport(createSample(), 3, now)
    const entry = report.brands[0].entries[0]
    report.brands = Array.from({length: 60}, (_, index) => ({ id: String(index), name: `Brand ${index + 1} · Éditions Très Longues`, entries: [{ ...entry, id: String(index), destination: 'Back of House → Upstairs stockroom → Cabinet VERY-LONG-CODE → Drawer D01', stock: 'Caps and hats · Women', from: 'Sales floor → Shelf S01', reason: 'Moved for the new season. Keep additional locations available.' }] }))
    const pdf = createReportPdf(report, font)
    expect(pdf.getNumberOfPages()).toBeGreaterThan(2)
    const data = new Uint8Array(pdf.output('arraybuffer'))
    expect(new TextDecoder().decode(data.subarray(0, 8))).toBe('%PDF-1.3')
    if (process.env.REPORT_QA_FILE) writeFileSync(process.env.REPORT_QA_FILE, data)
  })
})
