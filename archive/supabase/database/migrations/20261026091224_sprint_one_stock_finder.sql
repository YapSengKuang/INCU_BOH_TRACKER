-- Sprint 1. All writes pass through one serialised, authorised transaction.
-- SECURITY DEFINER implementations are isolated in an unexposed schema.
-- Public wrappers use invoker security; direct table writes are never granted.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  timezone text not null default 'Australia/Melbourne',
  revision bigint not null default 0 check (revision >= 0)
);
create table public.brands (
  store_id uuid not null references public.stores(id), id text not null,
  name text not null check (length(trim(name)) between 1 and 160), active boolean not null default false,
  aliases text[] not null default '{}', departments text[] not null default '{}',
  "sourcePages" text[] not null default '{}', "retrievedOn" date,
  primary key (store_id, id)
);
create unique index brands_name on public.brands (store_id, lower(name));
create table public.categories (
  store_id uuid not null references public.stores(id), id text not null,
  name text not null check (length(trim(name)) between 1 and 160), active boolean not null default true,
  primary key (store_id,id)
);
create unique index categories_name on public.categories (store_id,lower(name));
create table public.departments (like public.categories including all);
alter table public.departments add foreign key (store_id) references public.stores(id);
create unique index departments_name on public.departments (store_id,lower(name));
create table public.locations (
  store_id uuid not null references public.stores(id), id text not null,
  area text not null check (length(trim(area)) between 1 and 160),
  code text not null check (length(trim(code)) between 1 and 160),
  kind text not null check (kind in ('Cabinet','Rack','Shelf','Drawer','Room','Wall','Tub','Area')),
  "parentId" text, primary key (store_id,id),
  foreign key (store_id,"parentId") references public.locations(store_id,id),
  check ("parentId" is null or "parentId" <> id)
);
create unique index locations_code on public.locations (store_id,lower(code));
create index locations_parent on public.locations (store_id,"parentId");
create table public.stock_groups (
  store_id uuid not null references public.stores(id), id text not null,
  "brandId" text not null, "categoryId" text not null, "departmentId" text not null,
  primary key (store_id,id), unique (store_id,"brandId","categoryId","departmentId"),
  foreign key (store_id,"brandId") references public.brands(store_id,id),
  foreign key (store_id,"categoryId") references public.categories(store_id,id),
  foreign key (store_id,"departmentId") references public.departments(store_id,id)
);
create table public.placements (
  store_id uuid not null references public.stores(id), "groupId" text not null, "locationId" text not null,
  primary key (store_id,"groupId","locationId"),
  foreign key (store_id,"groupId") references public.stock_groups(store_id,id),
  foreign key (store_id,"locationId") references public.locations(store_id,id)
);
create index placements_location on public.placements (store_id,"locationId");
create table public.movements (
  store_id uuid not null references public.stores(id), id text not null,
  "groupId" text not null, kind text not null check (kind in ('place','also','move','correct','remove')),
  "groupLabel" text not null, "from" text, "to" text, "fromLabel" text, "toLabel" text,
  reason text not null default '' check (length(reason) <= 160), at timestamptz not null default now(),
  primary key (store_id,id), foreign key (store_id,"groupId") references public.stock_groups(store_id,id)
);
create index movements_newest on public.movements (store_id, at desc);
create table private.memberships (
  store_id uuid not null references public.stores(id), user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','editor')), primary key (store_id,user_id)
);
create table private.invitations (
  store_id uuid not null references public.stores(id), id uuid not null,
  email text not null check (email = lower(trim(email)) and length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), primary key (store_id,id), unique (store_id,email)
);
create table private.movement_details (
  store_id uuid not null, movement_id text not null, actor uuid references auth.users(id) on delete set null,
  note text not null default '' check (length(note) <= 2000), primary key (store_id,movement_id),
  foreign key (store_id,movement_id) references public.movements(store_id,id)
);
create table private.requests (
  store_id uuid not null references public.stores(id), id uuid not null, actor uuid references auth.users(id) on delete set null,
  command jsonb not null, revision bigint not null, primary key(store_id,id)
);
-- Public tables contain public directory fields only. No write policies/grants.
do $$ declare t text; begin
  foreach t in array array['stores','brands','categories','departments','locations','stock_groups','placements','movements'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to anon, authenticated',t);
    execute format('create policy public_directory on public.%I for select to anon, authenticated using (true)',t);
  end loop;
  foreach t in array array['memberships','invitations','movement_details','requests'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on private.%I from anon, authenticated',t);
  end loop;
end $$;

create function private.my_role(p_store uuid) returns text language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then 'guest' else coalesce((select role from private.memberships where store_id = p_store and user_id = auth.uid()),'guest') end;
$$;
revoke all on function private.my_role(uuid) from public,anon,authenticated;
grant execute on function private.my_role(uuid) to authenticated;
create function public.get_my_store_role(p_store uuid) returns text language sql stable security invoker set search_path = '' as $$ select private.my_role(p_store); $$;
revoke all on function public.get_my_store_role(uuid) from public,anon,authenticated;
grant execute on function public.get_my_store_role(uuid) to authenticated;

create function public.get_store_snapshot(p_store uuid) returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
   'store', to_jsonb(s),
   'brands',coalesce((select jsonb_agg(to_jsonb(b)-'store_id' order by b.name) from public.brands b where b.store_id=s.id),'[]'::jsonb),
   'categories',coalesce((select jsonb_agg(to_jsonb(b)-'store_id' order by b.name) from public.categories b where b.store_id=s.id),'[]'::jsonb),
   'departments',coalesce((select jsonb_agg(to_jsonb(b)-'store_id' order by b.name) from public.departments b where b.store_id=s.id),'[]'::jsonb),
   'locations',coalesce((select jsonb_agg(to_jsonb(b)-'store_id' order by b.code) from public.locations b where b.store_id=s.id),'[]'::jsonb),
   'groups',coalesce((select jsonb_agg(to_jsonb(b)-'store_id' order by b.id) from public.stock_groups b where b.store_id=s.id),'[]'::jsonb),
   'placements',coalesce((select jsonb_agg(to_jsonb(b)-'store_id' order by b."groupId",b."locationId") from public.placements b where b.store_id=s.id),'[]'::jsonb),
   'movements',coalesce((select jsonb_agg(to_jsonb(b)-'store_id' order by b.at desc) from public.movements b where b.store_id=s.id),'[]'::jsonb)
 ) from public.stores s where s.id=p_store;
$$;
revoke all on function public.get_store_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.get_store_snapshot(uuid) to anon,authenticated;

create function private.location_label(p_store uuid,p_id text) returns text language sql stable security invoker set search_path = '' as $$
  select l.area || ' → ' || case when p.id is null then '' else p.kind || ' ' || p.code || ' → ' end || l.kind || ' ' || l.code
  from public.locations l left join public.locations p on p.store_id=l.store_id and p.id=l."parentId" where l.store_id=p_store and l.id=p_id;
$$;
revoke all on function private.location_label(uuid,text) from public,anon,authenticated;

create function private.apply_command(p_store uuid,p_request uuid,p_expected bigint,p_action text,p_payload jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  rev bigint; r text; receipt private.requests; payload_id text := p_payload->>'id';
  g text; source text; dest text; k text; removes boolean; adds boolean; link_count integer;
  label text; old_label text; new_label text; t text; parent public.locations;
  em text; email_value text; target_user uuid;
begin
  if auth.uid() is null then raise exception 'Sign in with an invited staff account.' using errcode='42501'; end if;
  select revision into rev from public.stores where id=p_store for update;
  if not found then raise exception 'Store not found.'; end if;
  r := private.my_role(p_store);
  if r not in ('owner','editor') then raise exception 'Only invited staff can save changes.' using errcode='42501'; end if;
  select * into receipt from private.requests where store_id=p_store and id=p_request;
  if found then
    if receipt.actor is distinct from auth.uid() or receipt.command <> jsonb_build_object('action',p_action,'payload',p_payload) then raise exception 'Retry ID belongs to a different save.'; end if;
    return receipt.revision;
  end if;
  if p_expected is distinct from rev then raise exception 'STORE_CONFLICT: load the latest data and review your changes.' using errcode='40001'; end if;
  if p_request is null or payload_id is null or length(payload_id) not between 1 and 160 then raise exception 'Missing save ID.'; end if;
  case p_action
  when 'group' then
    if not exists(select 1 from public.brands where store_id=p_store and id=p_payload->>'brandId' and active)
      or not exists(select 1 from public.categories where store_id=p_store and id=p_payload->>'categoryId' and active)
      or not exists(select 1 from public.departments where store_id=p_store and id=p_payload->>'departmentId' and active) then raise exception 'Choose an active brand, category and department.'; end if;
    insert into public.stock_groups values(p_store,payload_id,p_payload->>'brandId',p_payload->>'categoryId',p_payload->>'departmentId');
  when 'location' then
    if p_payload->>'parentId' is not null then
      select * into parent from public.locations where store_id=p_store and id=p_payload->>'parentId';
      if not found or parent."parentId" is not null or parent.id=payload_id or parent.area<>trim(p_payload->>'area') then raise exception 'Choose a storage unit in the same area.'; end if;
      if exists(select 1 from public.locations where store_id=p_store and "parentId"=payload_id) then raise exception 'A unit with children cannot become a child location.'; end if;
    end if;
    if exists(select 1 from public.locations where store_id=p_store and "parentId"=payload_id and area<>trim(p_payload->>'area')) then raise exception 'Update child locations before changing this area.'; end if;
    insert into public.locations values(p_store,payload_id,trim(p_payload->>'area'),upper(trim(p_payload->>'code')),p_payload->>'kind',p_payload->>'parentId')
    on conflict(store_id,id) do update set area=excluded.area,code=excluded.code,kind=excluded.kind,"parentId"=excluded."parentId";
  when 'deleteLocation' then
    if exists(select 1 from public.placements where store_id=p_store and "locationId"=payload_id) then raise exception 'Move or remove all stock links before deleting this location.'; end if;
    if exists(select 1 from public.locations where store_id=p_store and "parentId"=payload_id) then raise exception 'Remove the drawers or shelves inside this unit first.'; end if;
    delete from public.locations where store_id=p_store and id=payload_id;
    if not found then raise exception 'This location no longer exists.'; end if;
  when 'taxon' then
    t := p_payload->>'table';
    if t not in ('brands','categories','departments') or t is null then raise exception 'Invalid option type.'; end if;
    execute format('insert into public.%I (store_id,id,name,active) values($1,$2,$3,$4) on conflict(store_id,id) do update set name=excluded.name,active=excluded.active',t)
      using p_store,payload_id,trim(p_payload->>'name'),(p_payload->>'active')::boolean;
  when 'movement' then
    g:=p_payload->>'groupId'; source:=p_payload->>'from'; dest:=p_payload->>'to'; k:=p_payload->>'kind';
    if k is null or k not in ('place','also','move','correct','remove') then raise exception 'Choose a movement action.'; end if;
    select b.name || ' · ' || c.name || ' · ' || d.name into label
      from public.stock_groups sg join public.brands b on b.store_id=sg.store_id and b.id=sg."brandId"
      join public.categories c on c.store_id=sg.store_id and c.id=sg."categoryId"
      join public.departments d on d.store_id=sg.store_id and d.id=sg."departmentId" where sg.store_id=p_store and sg.id=g;
    if not found then raise exception 'Stock group not found.'; end if;
    removes:=k in ('move','correct','remove'); adds:=k<>'remove';
    select count(*) into link_count from public.placements where store_id=p_store and "groupId"=g;
    if removes and (source is null or not exists(select 1 from public.placements where store_id=p_store and "groupId"=g and "locationId"=source)) then raise exception 'The selected source is no longer linked to this stock group.'; end if;
    if not removes and source is not null then raise exception 'An extra location cannot have a source.'; end if;
    if adds and (dest is null or not exists(select 1 from public.locations where store_id=p_store and id=dest)) then raise exception 'Choose a destination location.'; end if;
    if not adds and dest is not null then raise exception 'A removal cannot have a destination.'; end if;
    if source=dest then raise exception 'Choose a different destination.'; end if;
    if k='place' and link_count>0 then raise exception 'Use Also store here for an already placed group.'; end if;
    if k='also' and link_count=0 then raise exception 'Use a first placement for this group.'; end if;
    if k in ('correct','remove') and length(trim(coalesce(p_payload->>'reason','')))=0 then raise exception 'A correction reason is required.'; end if;
    if not removes and exists(select 1 from public.placements where store_id=p_store and "groupId"=g and "locationId"=dest) then raise exception 'This group is already at that location.'; end if;
    old_label:=private.location_label(p_store,source); new_label:=private.location_label(p_store,dest);
    if removes then delete from public.placements where store_id=p_store and "groupId"=g and "locationId"=source; end if;
    if adds then insert into public.placements values(p_store,g,dest) on conflict do nothing; end if;
    insert into public.movements values(p_store,payload_id,g,k,label,source,dest,old_label,new_label,trim(coalesce(p_payload->>'reason','')),now());
    insert into private.movement_details values(p_store,payload_id,auth.uid(),trim(coalesce(p_payload->>'privateNote','')));
  when 'invite' then
    if r<>'owner' then raise exception 'Only the owner can manage staff.' using errcode='42501'; end if;
    email_value:=lower(trim(p_payload->>'email'));
    if exists(select 1 from private.memberships m join auth.users u on m.user_id=u.id where m.store_id=p_store and lower(u.email)=email_value) then raise exception 'This person already has access.'; end if;
    insert into private.invitations(store_id,id,email,invited_by) values(p_store,payload_id::uuid,email_value,auth.uid());
  when 'revoke' then
    if r<>'owner' then raise exception 'Only the owner can manage staff.' using errcode='42501'; end if;
    if exists(select 1 from private.memberships where store_id=p_store and user_id=payload_id::uuid and role='owner') then raise exception 'Owner access cannot be removed here.'; end if;
    delete from private.invitations where store_id=p_store and id=payload_id::uuid;
    delete from private.memberships where store_id=p_store and user_id=payload_id::uuid and role='editor';
  else raise exception 'Unknown command.';
  end case;
  update public.stores set revision=revision+1 where id=p_store returning revision into rev;
  insert into private.requests values(p_store,p_request,auth.uid(),jsonb_build_object('action',p_action,'payload',p_payload),rev);
  return rev;
end $$;
revoke all on function private.apply_command(uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function private.apply_command(uuid,uuid,bigint,text,jsonb) to authenticated;
create function public.apply_store_command(p_store uuid,p_request uuid,p_expected bigint,p_action text,p_payload jsonb) returns bigint
language sql security invoker set search_path = '' as $$ select private.apply_command(p_store,p_request,p_expected,p_action,p_payload); $$;
revoke all on function public.apply_store_command(uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_store_command(uuid,uuid,bigint,text,jsonb) to authenticated;

create function private.accept_invitation(p_store uuid) returns void language plpgsql security definer set search_path = '' as $$
declare em text;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode='42501'; end if;
  perform 1 from public.stores where id=p_store for update;
  select lower(email) into em from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if em is null then raise exception 'A confirmed email address is required.'; end if;
  if private.my_role(p_store) in ('owner','editor') then return; end if;
  delete from private.invitations where store_id=p_store and email=em;
  if not found then raise exception 'No store invitation was found for this email.' using errcode='42501'; end if;
  insert into private.memberships values(p_store,auth.uid(),'editor');
  update public.stores set revision=revision+1 where id=p_store;
end $$;
revoke all on function private.accept_invitation(uuid) from public,anon,authenticated;
grant execute on function private.accept_invitation(uuid) to authenticated;
create function public.accept_store_invitation(p_store uuid) returns void language sql security invoker set search_path = '' as $$ select private.accept_invitation(p_store); $$;
revoke all on function public.accept_store_invitation(uuid) from public,anon,authenticated;
grant execute on function public.accept_store_invitation(uuid) to authenticated;

create function private.staff_list(p_store uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or private.my_role(p_store)<>'owner' then raise exception 'Only the owner can view staff accounts.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.item order by x.item->>'email') from (
   select jsonb_build_object('id',m.user_id,'email',u.email,'role',m.role,'status','active') item from private.memberships m join auth.users u on m.user_id=u.id where m.store_id=p_store
   union all select jsonb_build_object('id',i.id,'email',i.email,'role','editor','status','invited') from private.invitations i where i.store_id=p_store
 ) x),'[]'::jsonb);
end $$;
revoke all on function private.staff_list(uuid) from public,anon,authenticated;
grant execute on function private.staff_list(uuid) to authenticated;
create function public.get_store_staff(p_store uuid) returns jsonb language sql stable security invoker set search_path = '' as $$ select private.staff_list(p_store); $$;
revoke all on function public.get_store_staff(uuid) from public,anon,authenticated;
grant execute on function public.get_store_staff(uuid) to authenticated;

create function private.export_data(p_store uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or private.my_role(p_store)<>'owner' then raise exception 'Only the owner can export data.' using errcode='42501'; end if;
 return jsonb_build_object('schemaVersion',1,'exportedAt',now(),'snapshot',public.get_store_snapshot(p_store),'staff',private.staff_list(p_store),
   'privateNotes',coalesce((select jsonb_object_agg(movement_id,note) from private.movement_details where store_id=p_store),'{}'::jsonb),
   'databasePrivate',jsonb_build_object(
     'memberships',coalesce((select jsonb_agg(to_jsonb(m)) from private.memberships m where store_id=p_store),'[]'::jsonb),
     'invitations',coalesce((select jsonb_agg(to_jsonb(i)) from private.invitations i where store_id=p_store),'[]'::jsonb),
     'movementDetails',coalesce((select jsonb_agg(to_jsonb(d)) from private.movement_details d where store_id=p_store),'[]'::jsonb),
     'requests',coalesce((select jsonb_agg(to_jsonb(r)) from private.requests r where store_id=p_store),'[]'::jsonb)
   ));
end $$;
revoke all on function private.export_data(uuid) from public,anon,authenticated;
grant execute on function private.export_data(uuid) to authenticated;
create function public.export_store(p_store uuid) returns jsonb language sql stable security invoker set search_path = '' as $$ select private.export_data(p_store); $$;
revoke all on function public.export_store(uuid) from public,anon,authenticated;
grant execute on function public.export_store(uuid) to authenticated;
