import { readFileSync, writeFileSync } from 'node:fs'
const directory=JSON.parse(readFileSync(new URL('../Documentation/incu-brands.seed.json',import.meta.url),'utf8'))
const quote=s=>"'"+s.replaceAll("'","''")+"'"
const rows=directory.brands.map(b=>`(store,${quote(b.slug)},${quote(b.name)},false,${quote(JSON.stringify(b.departments))}::jsonb,${quote(JSON.stringify(b.source_pages))}::jsonb,${quote(directory.retrieved_on)}::date)`).join(',\n')
writeFileSync(new URL('../supabase/seed.sql',import.meta.url),`-- Generated from the documented Incu directory. All store brands begin disabled.
-- Safe to run once per fresh project. No sample stock is loaded.
do $$
declare store uuid;
begin
  if exists(select 1 from public.stores) then raise exception 'This seed expects a fresh project. Create additional stores explicitly.'; end if;
  insert into public.stores(name,timezone) values('Incu','Australia/Melbourne') returning id into store;
  insert into public.brands(store_id,id,name,active,departments,"sourcePages","retrievedOn")
  select v.store_id,v.id,v.name,v.active,array(select jsonb_array_elements_text(v.departments)),array(select jsonb_array_elements_text(v.sources)),v.retrieved
  from (values\n${rows}\n) v(store_id,id,name,active,departments,sources,retrieved);
  insert into public.categories(store_id,id,name) select store,lower(name),name from unnest(array['Knitwear','Denim','Footwear','T-shirts','Outerwear','Accessories','Dresses','Trousers']) name;
  insert into public.departments(store_id,id,name) select store,lower(name),name from unnest(array['Women','Men','Unisex']) name;
end $$;\n`)
