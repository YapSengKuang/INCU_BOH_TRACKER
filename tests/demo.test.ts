import { describe,it,expect } from 'vitest'
import { applyDemo,newDemoData as defaultDemoData } from '../src/lib/demo'
import type { DemoData } from '../src/lib/demo'
import { ConflictError,readBackup,searchGroups } from '../src/lib/model'
import type { Command,Request } from '../src/lib/model'
import { createSample } from './legacy-sample'
const newDemoData = (): DemoData => ({ ...defaultDemoData(), snapshot: createSample() })
const req=(d:DemoData,c:Command):Request=>({...c,requestId:crypto.randomUUID(),expectedRevision:d.snapshot.store.revision})
const move=(kind:'move'|'also'|'correct'|'remove'|'place',from:string|null,to:string|null,groupId='g1',reason=''):Command=>({action:'movement',payload:{id:crypto.randomUUID(),groupId,kind,from,to,reason,privateNote:'Private note'}})
describe('isolated sample workspace',()=>{
 it('searches words across brand, department, category and exact drawer',()=>{const d=newDemoData();expect(searchGroups(d.snapshot,'GANNI women D02').map(g=>g.id)).toEqual(['g1']);expect(searchGroups(d.snapshot,'salomon knitwear')).toHaveLength(0)})
 it('adds a second location and moves only the chosen source',()=>{let d=newDemoData();d=applyDemo(d,req(d,move('also',null,'s01')),'editor');d=applyDemo(d,req(d,move('move','d02','s02')),'editor');expect(d.snapshot.placements.filter(p=>p.groupId==='g1').map(p=>p.locationId).sort()).toEqual(['r01','s01','s02']);expect(d.snapshot.movements.at(-1)?.fromLabel).toContain('Drawer D02')})
 it('deduplicates an ambiguous retry even after the revision has advanced',()=>{let d=newDemoData();const request=req(d,move('move','d02','s02'));d=applyDemo(d,request,'editor');const once=JSON.stringify(d);expect(JSON.stringify(applyDemo(d,request,'editor'))).toBe(once);expect(()=>applyDemo(d,{...request,payload:{...request.payload,id:'changed'}} as Request,'editor')).toThrow('different save')})
 it('rejects stale changes without changing records',()=>{const d=newDemoData(),request=req(d,move('move','d02','s02')),updated=applyDemo(d,req(d,move('also',null,'s01')),'editor');expect(()=>applyDemo(updated,request,'editor')).toThrow(ConflictError);expect(updated.snapshot.placements.some(p=>p.groupId==='g1'&&p.locationId==='d02')).toBe(true)})
 it('keeps the input intact on failed history validation',()=>{const d=newDemoData(),before=JSON.stringify(d);expect(()=>applyDemo(d,req(d,move('correct','d02','s02')),'editor')).toThrow('reason');expect(JSON.stringify(d)).toBe(before)})
 it('records first placements and corrections without erasing earlier history',()=>{let d=newDemoData();d=applyDemo(d,req(d,move('place',null,'d02','g7')),'editor');d=applyDemo(d,req(d,move('remove','d02',null,'g7','Wrong drawer')),'editor');expect(d.snapshot.movements.filter(m=>m.groupId==='g7').map(m=>m.kind)).toEqual(['place','remove']);expect(d.snapshot.placements.filter(p=>p.groupId==='g7')).toHaveLength(0)})
 it('merges a move into an already linked destination without duplicates',()=>{let d=newDemoData();d=applyDemo(d,req(d,move('move','d02','r01')),'editor');expect(d.snapshot.placements.filter(p=>p.groupId==='g1')).toEqual([{groupId:'g1',locationId:'r01'}])})
 it('protects occupied locations, guests and owner actions',()=>{const d=newDemoData();expect(()=>applyDemo(d,req(d,{action:'deleteLocation',payload:{id:'d02'}}),'editor')).toThrow('stock links');expect(()=>applyDemo(d,req(d,move('also',null,'s01')),'guest')).toThrow('invited');expect(()=>applyDemo(d,req(d,{action:'invite',payload:{id:'staff1',email:'person@example.com'}}),'editor')).toThrow('owner')})
 it('round-trips a complete sample backup and rejects broken links',()=>{const d=newDemoData(),b={schemaVersion:1,exportedAt:new Date().toISOString(),snapshot:d.snapshot,staff:d.staff,privateNotes:d.privateNotes};expect(readBackup(JSON.parse(JSON.stringify(b)))).toEqual(b);const broken=structuredClone(b);broken.snapshot.placements.push({groupId:'missing',locationId:'d02'});expect(()=>readBackup(broken)).toThrow('broken stock location')})
})
