-- Synthetic fixtures only. Run against disposable PostgreSQL, never production.
\set ON_ERROR_STOP on
insert into public.innova_r2_evidence_registry(evidence_id,project_id,created_by,legacy_url,source_key,size_bytes,sha256,mime_type,enabled) values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','https://example.invalid/a','a',1000000,repeat('a',64),'image/jpeg',true),
('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','https://example.invalid/b','b',1000000,repeat('b',64),'image/jpeg',false),
('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','https://example.invalid/c','c',1000001,repeat('c',64),'image/jpeg',true);
do $$
begin
  if has_table_privilege('anon','public.innova_r2_evidence_registry','SELECT')
  or has_table_privilege('authenticated','public.innova_r2_evidence_registry','UPDATE')
  or has_table_privilege('authenticated','public.innova_r2_read_usage','INSERT')
  or has_function_privilege('anon','public.innova_reserve_r2_preview_read(uuid,uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.innova_reserve_r2_preview_read(uuid,uuid)','EXECUTE')
  then raise exception 'Forbidden grants'; end if;
  if not has_function_privilege('service_role','public.innova_reserve_r2_preview_read(uuid,uuid)','EXECUTE') then raise exception 'Missing service grant'; end if;
  if not (select bool_and(relrowsecurity) from pg_class where oid in ('public.innova_r2_evidence_registry'::regclass,'public.innova_r2_read_usage'::regclass)) then raise exception 'Missing RLS'; end if;
end $$;
set role service_role;
do $$
declare uid uuid := '30000000-0000-0000-0000-000000000001'; eid uuid := '10000000-0000-0000-0000-000000000001'; i int;
begin
  if public.innova_reserve_r2_preview_read(uid,'10000000-0000-0000-0000-000000000002') or public.innova_reserve_r2_preview_read(uid,'10000000-0000-0000-0000-000000000003') or public.innova_reserve_r2_preview_read(null,eid) or public.innova_reserve_r2_preview_read(uid,'10000000-0000-0000-0000-000000000099') then raise exception 'Invalid record accepted'; end if;
  for i in 1..20 loop
    if not public.innova_reserve_r2_preview_read(uid,eid) then raise exception 'Premature rejection %',i; end if;
  end loop;
  if public.innova_reserve_r2_preview_read(uid,eid) then raise exception 'User quota exceeded'; end if;
  for i in 1..80 loop
    if not public.innova_reserve_r2_preview_read(md5('fixture-user-'||i)::uuid,eid) then raise exception 'Premature global rejection %',i; end if;
  end loop;
  if public.innova_reserve_r2_preview_read(md5('fixture-extra')::uuid,eid) then raise exception 'Daily quota exceeded'; end if;
  if (select operations from public.innova_r2_read_usage where period_kind='day') <> 100 then raise exception 'Daily count mismatch'; end if;
  if (select bytes from public.innova_r2_read_usage where period_kind='month') <> 100000000 then raise exception 'Byte count mismatch'; end if;
end $$;
reset role;
truncate public.innova_r2_read_usage;
insert into public.innova_r2_read_usage values ('month',date_trunc('month',clock_timestamp() at time zone 'UTC')::date,'00000000-0000-0000-0000-000000000000',999,999000000);
set role service_role;
do $$
declare eid uuid := '10000000-0000-0000-0000-000000000001'; uid uuid := '30000000-0000-0000-0000-000000000001';
begin
  if not public.innova_reserve_r2_preview_read(uid,eid) then raise exception 'Monthly final request rejected'; end if;
  if public.innova_reserve_r2_preview_read(uid,eid) then raise exception 'Monthly quota exceeded'; end if;
end $$;
reset role;
truncate public.innova_r2_read_usage;
select 'PASS: RLS, grants, invalid objects, user/day/month limits and byte accounting' as result;
