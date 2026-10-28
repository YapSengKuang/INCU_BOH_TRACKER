import { useEffect, useState } from 'react'
import { ArrowRight, Clock3, MapPin } from 'lucide-react'
import type { Snapshot } from '../lib/model'
import { createMovementReport } from '../lib/movement-report'

export function MovementSummary({ snapshot, onFindStock, onHistory }: { snapshot: Snapshot; onFindStock: () => void; onHistory: () => void }) {
  const [days, setDays] = useState<3 | 7>(3)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const update = () => setNow(new Date())
    const timer = window.setInterval(update, 1000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [])
  const report = createMovementReport(snapshot, days, now)
  return <div className="home-summary">
    <div className="home-intro"><p className="muted">A quick look at your store’s stock location activity.</p><button className="button primary" onClick={onFindStock}>Find stock<ArrowRight size={16}/></button></div>
    <section className="summary-panel" aria-labelledby="movement-summary-heading">
      <div className="summary-heading"><div><h2 id="movement-summary-heading">Movement summary</h2></div><div className="summary-toggle" role="group" aria-label="Movement summary period">{([3, 7] as const).map(period => <button key={period} aria-pressed={days === period} onClick={() => { setDays(period); setNow(new Date()) }}>{period} days</button>)}</div></div>
      {report.brands.length > 0 && <div className="destination-summary">
        {report.brands.map(card => <article className="destination-card" key={card.id}>
          <div className="destination-heading"><h3>{card.name}</h3></div>
          <ul className="destination-stock">{card.entries.map(entry => <li key={entry.id}><div><div className="movement-destination"><MapPin size={17}/><strong>{entry.destination}</strong></div>{entry.stock && <p className="small">{entry.stock}</p>}<p className="muted small">{entry.action}{entry.from ? ` · From ${entry.from}` : ''}</p></div><time dateTime={entry.at}>{new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: snapshot.store.timezone }).format(new Date(entry.at))}</time></li>)}</ul>
        </article>)}
      </div>}
      {report.brands.length === 0 && <div className="summary-empty"><Clock3 size={20}/><div><strong>No stock arrivals in these {days} days</strong><p className="muted small">New placements and destination changes will appear here.</p></div></div>}
      <div className="summary-footer"><span className="muted small">Counts include confirmed saves only.</span><button className="text-button" onClick={onHistory}>View all movement history<ArrowRight size={15}/></button></div>
    </section>
  </div>
}
