-- Disposable PostgreSQL only: synthetic records and no production access.
insert into public.innova_r2_evidence_registry(evidence_id,project_id,created_by,legacy_url,source_key,size_bytes,sha256,mime_type,enabled) values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','https://example.invalid/a','a',1000000,repeat('a',64),'image/jpeg',true),
('10000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','https://example.invalid/b','b',50000000,repeat('b',64),'video/mp4',true),
('10000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','https://example.invalid/c','c',50000000,repeat('c',64),'video/mp4',false);
do $$
begin
  if has_function_privilege('anon','public.innova_reserve_r2_gateway_read(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.innova_reserve_r2_gateway_read(uuid,uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.innova_reserve_r2_gateway_read(uuid,uuid)','EXECUTE')
  then raise exception 'Unexpected RPC privileges'; end if;
end $$;
set role service_role;
do $$
declare uid uuid:='30000000-0000-0000-0000-000000000001'; eid uuid:='10000000-0000-0000-0000-000000000001'; i int;
begin
  if public.innova_reserve_r2_gateway_read(uid,'10000000-0000-0000-0000-000000000005') or public.innova_reserve_r2_gateway_read(uid,'10000000-0000-0000-0000-000000000099') or public.innova_reserve_r2_gateway_read(null,eid) then raise exception 'Invalid evidence allowed'; end if;
  for i in 1..40 loop
    if not public.innova_reserve_r2_gateway_read(uid,eid) then raise exception 'Premature user-limit rejection %',i; end if;
  end loop;
  if public.innova_reserve_r2_gateway_read(uid,eid) then raise exception 'User operation limit not enforced'; end if;
end $$;
reset role;
truncate public.innova_r2_read_usage;
set role service_role;
do $$
declare eid uuid:='10000000-0000-0000-0000-000000000001'; i int;
begin
  for i in 1..200 loop
    if not public.innova_reserve_r2_gateway_read(md5('user-'||((i-1)%5))::uuid,eid) then raise exception 'Global operation limit premature %',i; end if;
  end loop;
  if public.innova_reserve_r2_gateway_read(md5('extra-user')::uuid,eid) then raise exception 'Global daily operation limit not enforced'; end if;
end $$;
reset role;
truncate public.innova_r2_read_usage;
set role service_role;
do $$
declare eid uuid:='10000000-0000-0000-0000-000000000004'; i int;
begin
  for i in 1..10 loop
    if not public.innova_reserve_r2_gateway_read(md5('large-user-'||((i-1)%3))::uuid,eid) then raise exception 'Global daily byte limit premature %',i; end if;
  end loop;
  if public.innova_reserve_r2_gateway_read(md5('extra-user')::uuid,eid) then raise exception 'Daily byte limit not enforced'; end if;
end $$;
reset role;
truncate public.innova_r2_read_usage;
insert into public.innova_r2_read_usage(period_kind,period_start,subject,operations,bytes)
values ('month',date_trunc('month',clock_timestamp() at time zone 'UTC')::date,'00000000-0000-0000-0000-000000000000',100,3950000000);
set role service_role;
do $$
declare eid uuid:='10000000-0000-0000-0000-000000000004'; uid uuid:='30000000-0000-0000-0000-000000000001';
begin
  if not public.innova_reserve_r2_gateway_read(uid,eid) then raise exception 'Final 50MB monthly issuance rejected'; end if;
  if public.innova_reserve_r2_gateway_read(uid,eid) then raise exception 'Monthly byte limit not enforced'; end if;
end $$;
reset role;
truncate public.innova_r2_read_usage;
select 'PASS: Dell gateway RLS, grants, user and global operations, 500MB/day and 4GB/month' as result;
