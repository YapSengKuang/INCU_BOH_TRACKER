import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Movement, Snapshot } from '../src/lib/model'
import { createSample } from '../src/lib/sample'
import { createMovementReport } from '../src/lib/movement-report'
import { createReportPdf } from '../src/lib/movement-report-pdf'
import { MovementReportContent } from '../src/components/MovementReportPreview'

const now = new Date('2026-10-28T02:00:00Z')
function scenario(changes: { kind: Movement['kind']; from: string | null; to: string | null; at: string }[]): Snapshot {
  const snapshot = createSample()
  snapshot.movements = changes.map((change, i) => ({ ...snapshot.movements[0], ...change, id: `change-${i}`, fromLabel: change.from, toLabel: change.to, reason: '' }))
  return snapshot
}
const entries = (snapshot: Snapshot, days: 3 | 7 = 3) => createMovementReport(snapshot, days, now).brands.flatMap(brand => brand.entries)
const change = (kind: Movement['kind'], from: string | null, to: string | null, at: string) => ({ kind, from, to, at })

describe('handover report edge cases', () => {
  it('collapses a chain and a return trip to the last destination without duplicates', () => {
    const snapshot = scenario([
      change('place', null, 'Room A', '2026-10-26T00:00:00Z'),
      change('move', 'Room A', 'Room B', '2026-10-26T02:00:00Z'),
      change('move', 'Room B', 'Room C', '2026-10-27T00:00:00Z'),
      change('move', 'Room C', 'Room A', '2026-10-28T00:00:00Z'),
    ])
    snapshot.movements.reverse()
    expect(entries(snapshot).map(row => [row.destination, row.from, row.at])).toEqual([['Room A', 'Room C', '2026-10-28T00:00:00Z']])
  })
  it('keeps both destinations when one branch of split stock moves again', () => {
    const snapshot = scenario([
      change('place', null, 'Room A', '2026-10-26T00:00:00Z'),
      change('also', null, 'Room B', '2026-10-26T02:00:00Z'),
      change('move', 'Room A', 'Room C', '2026-10-27T00:00:00Z'),
      change('correct', 'Room B', 'Room D', '2026-10-28T00:00:00Z'),
    ])
    expect(entries(snapshot).map(row => row.destination)).toEqual(['Room C', 'Room D'])
    const html = renderToStaticMarkup(createElement(MovementReportContent, { report: createMovementReport(snapshot, 3, now) }))
    expect(html).toContain('Room C'); expect(html).toContain('Room D')
    expect(html).not.toContain('>Room A<'); expect(html).not.toContain('>Room B<')
  })
  it('only includes changed links within the selected days, including a midnight arrival', () => {
    const snapshot = scenario([
      change('place', null, 'Room A', '2026-10-23T00:00:00Z'),
      change('also', null, 'Room B', '2026-10-25T13:00:00Z'),
    ])
    expect(entries(snapshot, 3).map(row => row.destination)).toEqual(['Room B'])
    expect(entries(snapshot, 7).map(row => row.destination)).toEqual(['Room A', 'Room B'])
  })
  it('removing one split link leaves the other destination in the report', () => {
    const snapshot = scenario([
      change('place', null, 'Room A', '2026-10-26T00:00:00Z'),
      change('also', null, 'Room B', '2026-10-27T00:00:00Z'),
      change('remove', 'Room A', null, '2026-10-28T00:00:00Z'),
    ])
    expect(entries(snapshot).map(row => row.destination)).toEqual(['Room B'])
  })
  it.each(['none', 'outside-window', 'removal-only', 'all-removed'] as const)('renders an explicit empty report for %s', mode => {
    const snapshot = scenario(mode === 'none' ? [] : mode === 'outside-window' ? [change('place', null, 'Room A', '2026-10-20T00:00:00Z')] : mode === 'removal-only' ? [change('remove', 'Room A', null, '2026-10-28T00:00:00Z')] : [change('place', null, 'Room A', '2026-10-26T00:00:00Z'), change('remove', 'Room A', null, '2026-10-28T00:00:00Z')])
    const report = createMovementReport(snapshot, 3, now)
    expect(report.brands).toEqual([])
    const html = renderToStaticMarkup(createElement(MovementReportContent, { report }))
    expect(html).toContain('No stock arrivals in these 3 days.')
    expect(html).toContain('26 Oct 2026 - 28 Oct 2026')
  })
  it('keeps all long rows in the HTML and generates multipage and empty PDFs for print QA', () => {
    const report = createMovementReport(createSample(), 3, now)
    const entry = report.brands[0].entries[0]
    report.brands = Array.from({ length: 75 }, (_, index) => ({ id: `brand-${index}`, name: `Brand ${String(index + 1).padStart(3, '0')} · Éditions Très Longues`, entries: [{ ...entry, id: `row-${index}`, destination: 'Back of House → Upstairs stockroom → Cabinet VERY-LONG-CODE → Drawer D01', stock: 'Caps and hats · Women', from: 'Sales floor → Shelf S01', reason: 'Moved for the new season. Keep additional locations available.' }] }))
    const html = renderToStaticMarkup(createElement(MovementReportContent, { report }))
    expect((html.match(/<tr>/g) ?? []).length).toBe(76)
    expect(html).toContain('Brand 001'); expect(html).toContain('Brand 075')
    const font = readFileSync(new URL('../public/fonts/Geist-Variable.ttf', import.meta.url)).toString('base64')
    const pdf = createReportPdf(report, font)
    expect(pdf.getNumberOfPages()).toBeGreaterThan(3)
    if (process.env.REPORT_QA_DIR) {
      const dir = process.env.REPORT_QA_DIR
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'multipage.pdf'), new Uint8Array(pdf.output('arraybuffer')))
      const empty = createMovementReport(scenario([]), 3, now)
      writeFileSync(join(dir, 'empty.pdf'), new Uint8Array(createReportPdf(empty, font).output('arraybuffer')))
      const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
      for (const [name, data] of [['multipage', report], ['empty', empty]] as const) {
        const content = renderToStaticMarkup(createElement(MovementReportContent, { report: data }))
        const page = `<!doctype html><html><head><meta charset="utf-8"><title>Report print QA: ${name}</title><style>${css}</style></head><body><div id="root">APPLICATION NAVIGATION MUST NOT PRINT</div><div class="report-overlay"><dialog class="dialog"><div class="dialog-head"><h2>Report print QA: ${name}</h2></div><div class="report-actions"><button class="button primary" onclick="window.print()">Print report</button></div>${content}</dialog><div class="report-print" aria-hidden="true">${content}</div></div><script>document.querySelector('dialog').showModal()</script></body></html>`
        writeFileSync(join(dir, `${name}.html`), page)
        if (process.env.REPORT_BROWSER_QA_DIR) { mkdirSync(process.env.REPORT_BROWSER_QA_DIR, { recursive: true }); writeFileSync(join(process.env.REPORT_BROWSER_QA_DIR, `${name}.html`), page) }
      }
    }
  })
})
