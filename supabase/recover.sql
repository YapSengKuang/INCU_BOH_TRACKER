-- Admin-only recovery into a NEW store, never an overwrite.
-- Install once with SQL Editor/psql. No API role can execute it.
-- p_backup must be a connected-store export, not a browser sample export.
-- Referenced auth.users must already exist in the recovery project. Restore
-- identities or map their IDs in the backup before recovering across projects.
create or replace function private.recover_store(p_backup jsonb,p_new_store uuid,p_new_name text)
returns void language plpgsql security invoker set search_path = '' as $$
declare s jsonb := p_backup->'snapshot'; t text; source_key text;
begin
  if p_backup->>'schemaVersion' is distinct from '1' or p_backup->'databasePrivate' is null or s->'store' is null then raise exception 'A complete connected-store Sprint 1 export is required.'; end if;
  if exists(select 1 from public.stores where id=p_new_store) then raise exception 'Recovery requires a new store ID.'; end if;
  insert into public.stores(id,name,timezone,revision) values(p_new_store,p_new_name,s->'store'->>'timezone',(s->'store'->>'revision')::bigint);
  foreach t in array array['brands','categories','departments','locations','stock_groups','placements','movements'] loop
    source_key := case when t='stock_groups' then 'groups' else t end;
    if jsonb_typeof(s->source_key) is distinct from 'array' then raise exception 'Backup is missing %.',source_key; end if;
    execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I,$1)',t,t)
      using (select coalesce(jsonb_agg(item || jsonb_build_object('store_id',p_new_store)),'[]'::jsonb) from jsonb_array_elements(s->source_key) item);
  end loop;
  foreach t in array array['memberships','invitations','movement_details','requests'] loop
    source_key := case when t='movement_details' then 'movementDetails' else t end;
    if jsonb_typeof(p_backup->'databasePrivate'->source_key) is distinct from 'array' then raise exception 'Backup is missing private %.',source_key; end if;
    execute format('insert into private.%I select * from jsonb_populate_recordset(null::private.%I,$1)',t,t)
      using (select coalesce(jsonb_agg(item || jsonb_build_object('store_id',p_new_store)),'[]'::jsonb) from jsonb_array_elements(p_backup->'databasePrivate'->source_key) item);
  end loop;
end $$;
revoke all on function private.recover_store(jsonb,uuid,text) from public,anon,authenticated;
