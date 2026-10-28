import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { MovementReport } from './movement-report'
import { reportDate, reportPeriod } from './movement-report'

export function createReportPdf(report: MovementReport, font: string) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm', compress: true })
  doc.addFileToVFS('Geist.ttf', font)
  doc.addFont('Geist.ttf', 'Geist', 'normal')
  doc.setFont('Geist', 'normal')
  doc.setProperties({ title: `${report.store} - Movement report`, subject: `${report.days}-day movement summary` })
  const body = report.brands.flatMap(brand => brand.entries.map(entry => [
    brand.name, [entry.destination, entry.stock].filter(Boolean).join('\n'),
    [entry.action, entry.from ? `From ${entry.from}` : '', entry.reason ? `Note: ${entry.reason}` : ''].filter(Boolean).join('\n'),
    reportDate(entry.at, report.timezone),
  ]))
  const headerLines = doc.splitTextToSize(report.store, 178) as string[]
  const headingHeight = headerLines.length * 5
  const top = 40 + headingHeight
  autoTable(doc, {
    startY: top, margin: { top, bottom: 18, left: 16, right: 16 },
    head: [['Brand', 'Destination / stock', 'Change', 'Recorded']],
    body: body.length ? body : [[{ content: `No stock arrivals in these ${report.days} days.`, colSpan: 4 }]],
    styles: { font: 'Geist', fontStyle: 'normal', fontSize: 9, cellPadding: 3, overflow: 'linebreak', lineColor: [200, 211, 218], lineWidth: 0.15 },
    headStyles: { fillColor: [0, 78, 137], textColor: 255, fontStyle: 'normal' },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 60 }, 2: { cellWidth: 51 }, 3: { cellWidth: 33 } },
    rowPageBreak: 'avoid',
    willDrawPage: () => {
      doc.setFont('Geist', 'normal'); doc.setTextColor(25, 52, 74)
      doc.setFontSize(11); doc.text(headerLines, 16, 16)
      doc.setFontSize(17); doc.text('Movement report', 16, 20 + headingHeight)
      doc.setFontSize(9)
      doc.text(`${report.days} days | ${reportPeriod(report)} | Today so far`, 16, 27 + headingHeight)
      doc.text(`Store-wide | ${report.timezone}`, 16, 32 + headingHeight)
      doc.text(`Generated ${reportDate(report.generated, report.timezone)}`, 16, 37 + headingHeight)
    },
  })
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(82, 102, 120)
    doc.text('Confirmed saves only', 16, 286)
    doc.text(`Page ${page} of ${pages}`, 194, 286, { align: 'right' })
  }
  return doc
}

export async function downloadReportPdf(report: MovementReport) {
  const response = await fetch('/fonts/Geist-Variable.ttf')
  if (!response.ok) throw new Error('Could not load the report font. Please try again.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  // Chunk conversion to avoid exceeding argument limits for font data.
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  const doc = createReportPdf(report, btoa(binary))
  doc.save(`movement-report-${report.days}-days-${report.end}.pdf`)
}
