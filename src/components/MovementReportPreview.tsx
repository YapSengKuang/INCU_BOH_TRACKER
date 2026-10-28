import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownToLine, Printer, RefreshCw } from 'lucide-react'
import { Dialog } from './Dialog'
import type { MovementReport } from '../lib/movement-report'
import { reportDate, reportPeriod } from '../lib/movement-report'

export function MovementReportPreview({ report, onClose, onRefresh }: { report: MovementReport; onClose: () => void; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function download() {
    setBusy(true); setError('')
    try { const { downloadReportPdf } = await import('../lib/movement-report-pdf'); await downloadReportPdf(report) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create the PDF. Please try again.') }
    finally { setBusy(false) }
  }
  return createPortal(<div className="report-overlay"><Dialog title="Report preview" onClose={onClose}>
    <div className="report-actions"><button className="button secondary" onClick={onRefresh} disabled={busy}><RefreshCw size={16}/>Refresh report</button><button className="button secondary" onClick={()=>window.print()}><Printer size={16}/>Print</button><button className="button primary" onClick={download} disabled={busy}><ArrowDownToLine size={16}/>{busy ? 'Preparing PDF…' : 'Download PDF'}</button></div>
    {error && <p className="form-error report-error" role="alert">{error}</p>}
    <MovementReportContent report={report}/>
  </Dialog><div className="report-print" aria-hidden="true"><MovementReportContent report={report}/></div></div>, document.body)
}

export function MovementReportContent({ report }: { report: MovementReport }) {
  return <div className="report-paper">
      <header className="report-header"><p>{report.store}</p><h1>Movement report</h1><p>{report.days} days · {reportPeriod(report)} · Today so far</p><p className="muted small">Store-wide · {report.timezone}<br/>Generated {reportDate(report.generated, report.timezone)}</p></header>
      <table className="report-table"><thead><tr><th scope="col">Brand</th><th scope="col">Destination / stock</th><th scope="col">Change</th><th scope="col">Recorded</th></tr></thead><tbody>
        {report.brands.flatMap(brand => brand.entries.map(entry => <tr key={`${brand.id}-${entry.id}`}><th scope="row">{brand.name}</th><td><strong>{entry.destination}</strong>{entry.stock && <div>{entry.stock}</div>}</td><td>{entry.action}{entry.from && <div>From {entry.from}</div>}{entry.reason && <div>Note: {entry.reason}</div>}</td><td>{reportDate(entry.at, report.timezone)}</td></tr>))}
        {!report.brands.length && <tr><td colSpan={4}>No stock arrivals in these {report.days} days.</td></tr>}
      </tbody></table>
      <footer className="report-note">Confirmed saves only</footer>
    </div>
}
