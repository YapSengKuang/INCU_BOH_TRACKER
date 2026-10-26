import { useEffect, useRef, useState } from 'react'
import type { ReactNode, FormEvent } from 'react'
import { X, RefreshCw, ArrowRight } from 'lucide-react'
import { ConflictError } from '../lib/model'
import type { Command, Role, Snapshot } from '../lib/model'
import { save } from '../lib/api'
export function Dialog({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current!, before = document.activeElement as HTMLElement | null
    d.showModal()
    const cancel = (e: Event) => { e.preventDefault(); onClose() }
    d.addEventListener('cancel', cancel)
    return () => { d.removeEventListener('cancel', cancel); d.close(); before?.focus() }
  }, [onClose])
  return <dialog ref={ref} className="dialog" onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}><div className="dialog-head"><div><p className="eyebrow">STOCK WORKSPACE</p><h2>{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}</div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</dialog>
}
export function SaveForm({ children, command, revision, role, onSaved, onRefresh, label = 'Save changes' }: { children: ReactNode; command: () => Command; revision: number; role: Role; onSaved: (s: Snapshot) => void; onRefresh: () => Promise<Snapshot>; label?: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [conflict, setConflict] = useState(false), [expected, setExpected] = useState(revision)
  const last = useRef<{ signature: string; id: string } | null>(null)
  const locked = useRef(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (locked.current) return
    locked.current = true; setBusy(true); setError('')
    try {
      const c = command(), signature = JSON.stringify({ ...c, expected })
      if (last.current?.signature !== signature) last.current = { signature, id: crypto.randomUUID() }
      onSaved(await save({ ...c, requestId: last.current.id, expectedRevision: expected }, role))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your entry is still here. Try again.'); setConflict(e instanceof ConflictError) }
    finally { locked.current = false; setBusy(false) }
  }
  return <form onSubmit={submit} className="stack"><fieldset disabled={busy || conflict} className="form-fields">{children}</fieldset>{error && <div className="form-error" role="alert">{error}</div>}{conflict && <button className="button secondary" type="button" disabled={busy} onClick={async () => { setBusy(true); try { const latest = await onRefresh(); setExpected(latest.store.revision); setConflict(false); setError('Latest data loaded. Review your selections before saving again.'); last.current = null } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }}><RefreshCw size={16}/> Load latest data</button>}<div className="dialog-foot"><span className="muted small">{busy ? 'Saving your changes…' : 'Locations and history save together.'}</span><button className="button primary" disabled={busy || conflict}>{busy ? 'Saving…' : label}<ArrowRight size={16}/></button></div></form>
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="field"><span>{label}</span>{children}{hint && <small className="muted">{hint}</small>}</label> }
