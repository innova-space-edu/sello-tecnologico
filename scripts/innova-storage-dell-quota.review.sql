-- REVIEW ONLY: apply separately after disposable tests, with explicit approval.
-- Extended read reservation for the Dell authorization API (presigned R2 GET).
-- Counts each issued URL as a FULL file read, even when download fails.
-- Short-lived presigned URLs may be reused until expiry: this is NOT a hard billing cap.
-- Existing 1MB preview function remains unchanged; both share advisory lock / counters.
create or replace function public.innova_reserve_r2_gateway_read(p_user_id uuid,p_evidence_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day date;
  v_month date;
  v_global constant uuid := '00000000-0000-0000-0000-000000000000';
  v_bytes bigint;
  v_ops bigint;
  v_used bigint;
  rec record;
begin
  if p_user_id is null or p_user_id=v_global or p_evidence_id is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(789051628::bigint);
  v_day := (clock_timestamp() at time zone 'UTC')::date;
  v_month := date_trunc('month',v_day::timestamp)::date;
  select size_bytes into v_bytes from public.innova_r2_evidence_registry
    where evidence_id=p_evidence_id and enabled and size_bytes between 1 and 100000000 for share;
  if v_bytes is null then return false; end if;
  for rec in select * from (values
    ('day'::text,v_day,v_global,200::bigint,500000000::bigint),
    ('month'::text,v_month,v_global,5000::bigint,4000000000::bigint),
    ('user_day'::text,v_day,p_user_id,40::bigint,200000000::bigint)
  ) as lim(kind,start_date,who,max_ops,max_bytes)
  loop
    select operations,bytes into v_ops,v_used from public.innova_r2_read_usage
      where period_kind=rec.kind and period_start=rec.start_date and subject=rec.who;
    if coalesce(v_ops,0)+1>rec.max_ops or coalesce(v_used,0)+v_bytes>rec.max_bytes then return false; end if;
  end loop;
  insert into public.innova_r2_read_usage(period_kind,period_start,subject,operations,bytes)
  values ('day',v_day,v_global,1,v_bytes),
    ('month',v_month,v_global,1,v_bytes),
    ('user_day',v_day,p_user_id,1,v_bytes)
  on conflict (period_kind,period_start,subject) do update
    set operations=public.innova_r2_read_usage.operations+excluded.operations,
        bytes=public.innova_r2_read_usage.bytes+excluded.bytes;
  return true;
end;
$$;
revoke all on function public.innova_reserve_r2_gateway_read(uuid,uuid) from public, anon, authenticated;
grant execute on function public.innova_reserve_r2_gateway_read(uuid,uuid) to service_role;
