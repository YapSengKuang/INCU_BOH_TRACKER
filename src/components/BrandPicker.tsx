import { useState } from 'react'
import { ArrowUpRight, Plus } from 'lucide-react'
import type { Brand, Command, Snapshot } from '../lib/model'
export function BrandPicker({s,query,onAdd,onManage,pendingIds}:{
  s:Snapshot;query:string;onAdd:(commands:Command[])=>void;onManage:(brand:Brand)=>void;pendingIds:Set<string>
}){
  const [selected,setSelected]=useState<string[]>([]),[error,setError]=useState('')
  const pending=selected.filter(id=>s.brands.some(b=>b.id===id&&!b.active))
  const visible=s.brands.filter(b=>b.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name))
  function addBrands(){
    try{
      onAdd(pending.map(id=>{const brand=s.brands.find(b=>b.id===id)!;return {action:'taxon',payload:{table:'brands',id,name:brand.name,active:true}}}))
      setSelected([]);setError('')
    }catch(e){setError((e as Error).message)}
  }
  return <div>
    <div className="brand-selection-bar"><span className="muted small">{pending.length} selected</span>{!!pending.length&&<button className="text-button" onClick={()=>setSelected([])}>Clear selection</button>}<button className="button primary" disabled={!pending.length} onClick={addBrands}><Plus size={16}/>Add to store{!!pending.length&&` (${pending.length})`}</button></div>
    {error&&<p role="alert" className="form-error">{error}</p>}
    <div className="option-list">{visible.map(brand=><div className="option-row brand-option-row" key={brand.id}>
      <label className="brand-choice"><input type="checkbox" aria-label={`Select ${brand.name}`} checked={brand.active||selected.includes(brand.id)} disabled={brand.active||pendingIds.has(brand.id)} onChange={e=>{const checked=e.target.checked;setSelected(ids=>checked?[...ids,brand.id]:ids.filter(id=>id!==brand.id))}}/><span><strong>{brand.name}</strong><small>{brand.departments.join(' / ')||'Added by your store'}</small></span></label>
      <span className={`availability ${brand.active?'enabled':''}`}>{pendingIds.has(brand.id)?'Saving…':brand.active?'In store':'Not added'}</span>
      <button className="text-button" disabled={pendingIds.has(brand.id)} aria-label={`Manage ${brand.name}`} onClick={()=>onManage(brand)}>Manage<ArrowUpRight size={14}/></button>
    </div>)}{!visible.length&&<p className="muted small">No brands match your search.</p>}</div>
  </div>
}
