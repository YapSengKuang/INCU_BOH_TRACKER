import { useRef, useState } from 'react'
import { ArrowUpRight, Plus } from 'lucide-react'
import { loadSnapshot, save } from '../lib/api'
import type { Brand, Role, Snapshot } from '../lib/model'

export function BrandPicker({ s, role, query, onSaved, onManage }: {
  s: Snapshot; role: Role; query: string; onSaved: (next: Snapshot) => void; onManage: (brand: Brand) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const locked = useRef(false)
  const pending = selected.filter(id => s.brands.some(b => b.id === id && !b.active))
  const visible = s.brands.filter(b => b.name.toLowerCase().includes(query.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name))

  async function addBrands() {
    if (locked.current || !pending.length) return
    locked.current = true; setBusy(true); setError(''); setMessage('')
    let added = 0
    try {
      // Use the existing revision-checked staff command for each brand. Reload
      // first so a concurrent rename is never overwritten by an older label.
      let next = await loadSnapshot()
      onSaved(next)
      for (const id of pending) {
        const brand = next.brands.find(b => b.id === id)
        if (!brand) throw new Error('A selected brand was removed. Review your selection.')
        if (!brand.active) {
          setMessage(`Adding brands… ${added + 1} of ${pending.length}`)
          next = await save({ action: 'taxon', payload: { table: 'brands', id, name: brand.name, active: true }, requestId: crypto.randomUUID(), expectedRevision: next.store.revision }, role)
          added++
          onSaved(next)
        }
        setSelected(ids => ids.filter(value => value !== id))
      }
      setMessage(added ? `${added} brand${added === 1 ? '' : 's'} added to your store.` : 'Selected brands are already in your store.')
    } catch (e) {
      setMessage('')
      setError(`${added ? `${added} brand${added === 1 ? '' : 's'} added. ` : ''}${e instanceof Error ? e.message : 'Could not add brands.'} Your remaining selections are kept. Review them and try again.`)
      try { onSaved(await loadSnapshot()) } catch { /* Keep the last confirmed snapshot and selection. */ }
    } finally { locked.current = false; setBusy(false) }
  }

  return <div aria-busy={busy}>
    <div className="brand-selection-bar">
      <span className="muted small">{pending.length} selected</span>
      {!!pending.length && <button className="text-button" disabled={busy} onClick={() => setSelected([])}>Clear selection</button>}
      <button className="button primary" disabled={busy || !pending.length} onClick={addBrands}><Plus size={16}/>{busy ? 'Adding…' : 'Add to store'}{!!pending.length && !busy && ` (${pending.length})`}</button>
    </div>
    <div role="status" className="small brand-selection-status">{message}</div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="option-list">
      {visible.map(brand => <div className="option-row brand-option-row" key={brand.id}>
        <label className="brand-choice">
          <input type="checkbox" aria-label={`Select ${brand.name}`} checked={brand.active || selected.includes(brand.id)} disabled={busy || brand.active} onChange={e => setSelected(ids => e.target.checked ? [...ids, brand.id] : ids.filter(id => id !== brand.id))}/>
          <span><strong>{brand.name}</strong><small>{brand.departments.join(' / ') || 'Added by your store'}</small></span>
        </label>
        <span className={`availability ${brand.active ? 'enabled' : ''}`}>{brand.active ? 'In store' : 'Not added'}</span>
        <button className="text-button" disabled={busy} aria-label={`Manage ${brand.name}`} onClick={() => onManage(brand)}>Manage<ArrowUpRight size={14}/></button>
      </div>)}
      {!visible.length && <p className="muted small">No brands match your search.</p>}
    </div>
  </div>
}
