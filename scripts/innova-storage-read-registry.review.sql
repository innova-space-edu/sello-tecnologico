-- REVIEW DRAFT: additive schema, not applied automatically.
-- Registry populated only by trusted migration operator after comparing source and Dell manifest.
-- Never seed it from client-supplied URLs alone.
begin;
create table if not exists public.innova_r2_evidence_registry (
  evidence_id uuid primary key,
  project_id uuid not null,
  created_by uuid not null,
  legacy_url text not null check (length(legacy_url) between 1 and 4096),
  source_key text not null check (octet_length('evidencias/' || source_key) between 12 and 1024),
  size_bytes bigint not null check (size_bytes between 1 and 100000000),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text not null,
  verified_at timestamptz not null default now(),
  enabled boolean not null default false
);
alter table public.innova_r2_evidence_registry enable row level security;
revoke all on public.innova_r2_evidence_registry from public, anon, authenticated;
grant select,insert,update,delete on public.innova_r2_evidence_registry to service_role;

create table if not exists public.innova_r2_read_usage (
  period_kind text not null check (period_kind in ('day','month','user_day')),
  period_start date not null,
  subject uuid not null,
  operations bigint not null check (operations >= 0),
  bytes bigint not null check (bytes >= 0),
  primary key (period_kind,period_start,subject)
);
alter table public.innova_r2_read_usage enable row level security;
revoke all on public.innova_r2_read_usage from public, anon, authenticated;
grant select,insert,update,delete on public.innova_r2_read_usage to service_role;

-- All preview requests serialized under one transaction lock; fail closed on unavailable DB.
-- Limits are intentionally small and count failed upstream calls too. Not Cloudflare billing totals.
create or replace function public.innova_reserve_r2_preview_read(p_user_id uuid,p_evidence_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'UTC')::date;
  v_month date := date_trunc('month',v_day::timestamp)::date;
  v_global constant uuid := '00000000-0000-0000-0000-000000000000';
  v_bytes bigint;
  v_ops bigint;
  v_used bigint;
  rec record;
begin
  if p_user_id is null or p_user_id=v_global or p_evidence_id is null then return false; end if;
  select size_bytes into v_bytes from public.innova_r2_evidence_registry
    where evidence_id=p_evidence_id and enabled and size_bytes between 1 and 1000000;
  if v_bytes is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(789051628::bigint);
  for rec in select * from (values
    ('day'::text,v_day,v_global,100::bigint,100000000::bigint),
    ('month'::text,v_month,v_global,1000::bigint,1000000000::bigint),
    ('user_day'::text,v_day,p_user_id,20::bigint,20000000::bigint)
  ) as lim(kind,start_date,who,max_ops,max_bytes)
  loop
    select operations,bytes into v_ops,v_used from public.innova_r2_read_usage
      where period_kind=rec.kind and period_start=rec.start_date and subject=rec.who;
    if coalesce(v_ops,0)+1>rec.max_ops or coalesce(v_used,0)+v_bytes>rec.max_bytes then return false; end if;
  end loop;
  insert into public.innova_r2_read_usage(period_kind,period_start,subject,operations,bytes)
  values ('day',v_day,v_global,1,v_bytes),('month',v_month,v_global,1,v_bytes),('user_day',v_day,p_user_id,1,v_bytes)
  on conflict (period_kind,period_start,subject) do update
    set operations=public.innova_r2_read_usage.operations+excluded.operations,
        bytes=public.innova_r2_read_usage.bytes+excluded.bytes;
  return true;
end;
$$;
revoke all on function public.innova_reserve_r2_preview_read(uuid,uuid) from public, anon, authenticated;
grant execute on function public.innova_reserve_r2_preview_read(uuid,uuid) to service_role;
commit;
