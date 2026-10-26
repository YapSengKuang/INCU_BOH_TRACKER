import { beforeAll,afterAll,describe,it,expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { readBackup } from '../src/lib/model'
const store='10000000-0000-4000-8000-000000000001',owner='20000000-0000-4000-8000-000000000001',editor='20000000-0000-4000-8000-000000000002',outsider='20000000-0000-4000-8000-000000000003',unconfirmed='20000000-0000-4000-8000-000000000004'
let db:PGlite
async function asUser(id:string|null,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec(`set role ${role}`)}
async function admin(){await db.exec('reset role')}
async function revision(){return Number((await db.query<{revision:number}>('select revision from public.stores where id=$1',[store])).rows[0].revision)}
async function command(action:string,payload:unknown,expected?:number,request=crypto.randomUUID()) {return db.query<{revision:number}>('select public.apply_store_command($1,$2,$3,$4,$5::jsonb) revision',[store,request,expected??await revision(),action,JSON.stringify(payload)])}
const movement=(kind:string,from:string|null,to:string|null,groupId='g1',reason='',privateNote='Private staff detail')=>({id:crypto.randomUUID(),groupId,kind,from,to,reason,privateNote})
async function snapshot(id=store){return (await db.query<{s:unknown}>('select public.get_store_snapshot($1) s',[id])).rows[0].s as any}
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
 await db.exec(readFileSync(new URL('../supabase/migrations/20261026091224_sprint_one_stock_finder.sql',import.meta.url),'utf8'))
 await db.exec(readFileSync(new URL('../supabase/recover.sql',import.meta.url),'utf8'))
 await db.query('insert into auth.users values($1,$2,now()),($3,$4,now()),($5,$6,now()),($7,$8,null)',[owner,'owner@example.com',editor,'editor@example.com',outsider,'outsider@example.com',unconfirmed,'unconfirmed@example.com'])
 await db.query("insert into public.stores(id,name) values($1,'Test store')",[store]);await db.query("insert into private.memberships values($1,$2,'owner'),($1,$3,'editor')",[store,owner,editor]);
 await db.query("insert into public.brands(store_id,id,name,active) values($1,'ganni','GANNI',true)",[store]);await db.query("insert into public.categories values($1,'knitwear','Knitwear',true)",[store]);await db.query("insert into public.departments values($1,'women','Women',true)",[store]);
 await asUser(editor)
 await command('location',{id:'c03',area:'Sales floor',code:'C03',kind:'Cabinet',parentId:null});await command('location',{id:'d02',area:'Sales floor',code:'D02',kind:'Drawer',parentId:'c03'});await command('location',{id:'r01',area:'Back room',code:'R01',kind:'Rack',parentId:null});await command('location',{id:'s01',area:'Back room',code:'S01',kind:'Shelf',parentId:null});
 await command('group',{id:'g1',brandId:'ganni',categoryId:'knitwear',departmentId:'women'});
},30000)
afterAll(async()=>{await db?.close()})
describe('actual Postgres migration and permissions',()=>{
 it('guests can search public data but cannot write or read private accounts',async()=>{
  await asUser(null,'anon');expect((await snapshot()).groups).toHaveLength(1)
  await expect(command('location',{id:'bad'})).rejects.toThrow(/permission denied/)
  await expect(db.query('select * from private.memberships')).rejects.toThrow(/permission denied/)
  await expect(db.query('select * from private.movement_details')).rejects.toThrow(/permission denied/)
  await expect(db.query("insert into public.locations values($1,'bad','x','x','Rack',null)",[store])).rejects.toThrow(/permission denied/)
 })
 it('uninvited accounts cannot edit, export, or give themselves membership',async()=>{
  await asUser(outsider);await expect(command('location',{id:'bad'})).rejects.toThrow(/invited/)
  await expect(db.query('select public.export_store($1)',[store])).rejects.toThrow(/owner/)
  await expect(db.query('select public.accept_store_invitation($1)',[store])).rejects.toThrow(/No store invitation/)
  await expect(db.query("insert into private.memberships values($1,$2,'owner')",[store,outsider])).rejects.toThrow(/permission denied/)
 })
 it('saves placements and dated history together; repeat requests are idempotent',async()=>{
  await asUser(editor);const m=movement('place',null,'d02'),request=crypto.randomUUID(),old=await revision();await command('movement',m,old,request);await command('movement',m,old,request)
  const s=await snapshot();expect(s.placements).toEqual([{groupId:'g1',locationId:'d02'}]);expect(s.movements).toHaveLength(1);expect(s.movements[0].toLabel).toBe('Sales floor → Cabinet C03 → Drawer D02');expect(s.movements[0]).not.toHaveProperty('privateNote');expect(JSON.stringify(s)).not.toContain('Private staff detail')
  await expect(command('movement',{...m,to:'r01'},old,request)).rejects.toThrow(/different save/)
 })
 it('keeps split locations when moving one source, and merges duplicate destinations',async()=>{
  await asUser(editor);await command('movement',movement('also',null,'r01'));await command('movement',movement('move','d02','s01'))
  let s=await snapshot();expect(s.placements.map((x:any)=>x.locationId).sort()).toEqual(['r01','s01'])
  await command('movement',movement('move','s01','r01'));s=await snapshot();expect(s.placements).toEqual([{groupId:'g1',locationId:'r01'}])
 })
 it('rolls back both link changes and history when a private-note save fails',async()=>{
  await asUser(editor);const before=await snapshot();await expect(command('movement',movement('move','r01','s01','g1','', 'x'.repeat(2001)))).rejects.toThrow(/check constraint/);expect(await snapshot()).toEqual(before)
 })
 it('rejects competing edits with stale revisions and leaves records intact',async()=>{
  await asUser(editor);const stale=await revision();await command('movement',movement('also',null,'s01'),stale);const before=await snapshot();await expect(command('movement',movement('move','r01','d02'),stale)).rejects.toThrow(/STORE_CONFLICT/);expect(await snapshot()).toEqual(before)
 })
 it('requires correction reasons and preserves the original history',async()=>{
  await asUser(editor);await expect(command('movement',movement('correct','r01','d02'))).rejects.toThrow(/reason/);const before=await snapshot();await command('movement',movement('correct','r01','d02','g1','Wrong location'));const s=await snapshot();expect(s.movements).toHaveLength(before.movements.length+1);expect(s.movements.some((m:any)=>m.kind==='place')).toBe(true)
 })
 it('prevents deleting occupied units and cross-store or nested child references',async()=>{
  await asUser(editor);await expect(command('deleteLocation',{id:'d02'})).rejects.toThrow(/stock links/);await expect(command('deleteLocation',{id:'c03'})).rejects.toThrow(/drawers/)
  await expect(command('location',{id:'bad',code:'BAD',area:'Back room',kind:'Drawer',parentId:'c03'})).rejects.toThrow(/same area/)
  await expect(command('location',{id:'bad',code:'BAD',area:'Sales floor',kind:'Drawer',parentId:'d02'})).rejects.toThrow(/same area/)
  await expect(command('location',{id:'bad',code:'D02',area:'Sales floor',kind:'Drawer',parentId:null})).rejects.toThrow(/unique constraint/)
 })
 it('keeps location snapshots after rename and prevents out-of-store edits',async()=>{
  await asUser(editor);await command('location',{id:'d02',area:'Sales floor',code:'D04',kind:'Drawer',parentId:'c03'});expect((await snapshot()).movements.some((m:any)=>m.toLabel?.includes('Drawer D02'))).toBe(true)
  const other=crypto.randomUUID();await admin();await db.query("insert into public.stores(id,name) values($1,'Other store')",[other]);await asUser(editor);await expect(db.query('select public.apply_store_command($1,$2,0,$3,$4)',[other,crypto.randomUUID(),'location',JSON.stringify({id:'x',area:'x',code:'x',kind:'Rack',parentId:null})])).rejects.toThrow(/invited/)
 })
 it('owner manages invitations; acceptance requires matching confirmed email',async()=>{
  await asUser(editor);await expect(command('invite',{id:crypto.randomUUID(),email:'outsider@example.com'})).rejects.toThrow(/owner/)
  await asUser(owner);await command('invite',{id:crypto.randomUUID(),email:'outsider@example.com'});await command('invite',{id:crypto.randomUUID(),email:'unconfirmed@example.com'})
  await asUser(unconfirmed);await expect(db.query('select public.accept_store_invitation($1)',[store])).rejects.toThrow(/confirmed email/)
  await asUser(outsider);await db.query('select public.accept_store_invitation($1)',[store]);expect((await db.query<{r:string}>('select public.get_my_store_role($1) r',[store])).rows[0].r).toBe('editor')
  await asUser(owner);await command('revoke',{id:outsider});await asUser(outsider);await expect(command('location',{id:'x'})).rejects.toThrow(/invited/)
 })
 it('exports a complete owner backup and recovers every row into a fresh store',async()=>{
  await asUser(editor);await expect(db.query('select public.get_store_staff($1)',[store])).rejects.toThrow(/owner/)
  await asUser(owner);const backup=(await db.query<{b:any}>('select public.export_store($1) b',[store])).rows[0].b
  expect(readBackup(backup).snapshot.store.id).toBe(store);expect(backup.privateNotes).not.toEqual({});expect(backup.databasePrivate.requests.length).toBeGreaterThan(0)
  await expect(db.query('select private.recover_store($1,$2,$3)',[backup,crypto.randomUUID(),'Recovered'])).rejects.toThrow(/permission denied/)
  await admin();const restored=crypto.randomUUID();await db.query('select private.recover_store($1,$2,$3)',[backup,restored,'Recovered']);await asUser(owner)
  const recovered=(await db.query<{b:any}>('select public.export_store($1) b',[restored])).rows[0].b
  expect({...recovered.snapshot,store:backup.snapshot.store}).toEqual(backup.snapshot);expect(recovered.privateNotes).toEqual(backup.privateNotes);expect(recovered.staff).toEqual(backup.staff)
  for(const key of ['memberships','invitations','movementDetails','requests'])expect(recovered.databasePrivate[key].map((x:any)=>({...x,store_id:store}))).toEqual(backup.databasePrivate[key])
 })
 it('enables RLS on every exposed table and uses only invoker public functions',async()=>{
  await admin();const tables=await db.query<{relname:string;relrowsecurity:boolean}>("select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'");expect(tables.rows.length).toBe(8);expect(tables.rows.every(t=>t.relrowsecurity)).toBe(true)
  const funcs=await db.query<{proname:string;prosecdef:boolean}>("select proname,prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'");expect(funcs.rows.every(f=>!f.prosecdef)).toBe(true)
 })
})
it('loads all 140 documented brands into a clean store without sample stock',async()=>{
 const clean=new PGlite();try{await clean.exec('create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$ select null::uuid $$;');await clean.exec(readFileSync(new URL('../supabase/migrations/20261026091224_sprint_one_stock_finder.sql',import.meta.url),'utf8'));await clean.exec(readFileSync(new URL('../supabase/seed.sql',import.meta.url),'utf8'));expect((await clean.query<{count:number}>('select count(*)::int count from public.brands')).rows[0].count).toBe(140);expect((await clean.query('select * from public.stock_groups')).rows).toHaveLength(0)}finally{await clean.close()}
},30000)
