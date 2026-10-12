-- Sello Tecnológico: archivo administrativo, borrador de demostración y actas reales.
-- El borrador no tiene solicitud vinculada y NUNCA autoriza el ingreso.
create table if not exists public.sello_family_approval_acts (
  folio text primary key check (folio ~ '^(BORRADOR-)?ACTA-[0-9]{4}-[0-9]{3,}$'),
  record_type text not null check (record_type in ('borrador','aprobacion')),
  request_id uuid unique references public.family_authorization_requests(id),
  student_user_id uuid references auth.users(id),
  student_name text,
  guardian_name text,
  guardian_relationship text,
  institution_name text,
  reviewer_user_id uuid references auth.users(id),
  approved_at timestamptz,
  identity_verified_at timestamptz,
  legal_capacity_verified_at timestamptz,
  verified_method text,
  evidence_reference text,
  document_version text,
  signature_sha256 text,
  decisions jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  constraint sello_acta_draft_separation check (
    (record_type = 'borrador' and folio like 'BORRADOR-%' and
      request_id is null and student_user_id is null and reviewer_user_id is null
      and approved_at is null and signature_sha256 is null and identity_verified_at is null
      and legal_capacity_verified_at is null)
    or
    (record_type = 'aprobacion' and folio not like 'BORRADOR-%'
      and request_id is not null and student_user_id is not null
      and approved_at is not null and signature_sha256 is not null and
      reviewer_user_id is not null and identity_verified_at is not null
      and legal_capacity_verified_at is not null)
  )
);
create index if not exists sello_family_acts_date on public.sello_family_approval_acts(approved_at desc);
alter table public.sello_family_approval_acts enable row level security;
revoke all on public.sello_family_approval_acts from public,anon,authenticated;
grant select,insert on public.sello_family_approval_acts to service_role;

-- Sample is unmistakably fictitious and does not reference a real user.
insert into public.sello_family_approval_acts
 (folio,record_type,student_name,guardian_name,guardian_relationship,institution_name,notes)
values ('BORRADOR-ACTA-2026-001','borrador','Estudiante de ejemplo',
 'Apoderado/a de ejemplo','representante_legal','Institución de demostración',
 'DOCUMENTO FICTICIO SIN FIRMA, SIN VERIFICACIÓN Y SIN VALIDEZ DE AUTORIZACIÓN. No habilita acceso.')
on conflict (folio) do nothing;

create or replace function public.sello_capture_approved_act(p_request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  v record;
  v_year text;
  v_number integer;
  v_folio text;
begin
  select * into v from public.family_authorization_requests
  where id=p_request_id and platform='sello' and status in ('approved','revoked')
    and reviewed_at is not null and verified_by is not null
    and identity_verified_at is not null and legal_capacity_verified_at is not null
    and signature_sha256 is not null and guardian_full_name is not null
    and decisions->>'platform_access'='true';
  if not found then return; end if;
  if exists(select 1 from public.sello_family_approval_acts where request_id=p_request_id) then return; end if;
  v_year:=to_char(v.reviewed_at at time zone 'America/Santiago','YYYY');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('sello-actas-familiares'),v_year::integer);
  if exists(select 1 from public.sello_family_approval_acts where request_id=p_request_id) then return; end if;
  if v.verified_evidence_ref ~ ('^ACTA-'||v_year||'-[0-9]{3,}$')
    and not exists (select 1 from public.sello_family_approval_acts where folio=v.verified_evidence_ref)
  then
    v_folio:=v.verified_evidence_ref;
  else
    select coalesce(max(substring(folio from '[0-9]+$')::integer),0)+1 into v_number
      from public.sello_family_approval_acts
      where record_type='aprobacion' and folio like 'ACTA-'||v_year||'-%';
    v_folio:='ACTA-'||v_year||'-'||lpad(v_number::text,3,'0');
  end if;
  insert into public.sello_family_approval_acts
    (folio,record_type,request_id,student_user_id,student_name,guardian_name,
     guardian_relationship,institution_name,reviewer_user_id,approved_at,
     identity_verified_at,legal_capacity_verified_at,verified_method,
     evidence_reference,document_version,signature_sha256,decisions)
  values (v_folio,'aprobacion',v.id,v.student_user_id,v.student_name_declared,
    v.guardian_full_name,v.guardian_relationship,v.institution_name,v.verified_by,
    v.reviewed_at,v.identity_verified_at,v.legal_capacity_verified_at,
    v.verified_method,v.verified_evidence_ref,v.document_version,
    v.signature_sha256,v.decisions)
  on conflict(request_id) do nothing;
end $$;
revoke all on function public.sello_capture_approved_act(uuid) from public,anon,authenticated;
grant execute on function public.sello_capture_approved_act(uuid) to service_role;

create or replace function public.sello_act_on_approval()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.platform='sello' and new.status='approved' then
    perform public.sello_capture_approved_act(new.id);
  end if;
  return new;
end $$;
drop trigger if exists sello_act_approved on public.family_authorization_requests;
create trigger sello_act_approved after update of status on public.family_authorization_requests
for each row when (new.status='approved') execute function public.sello_act_on_approval();

do $$
declare v record;
begin
  for v in select id from public.family_authorization_requests
    where platform='sello' and status in ('approved','revoked')
    order by reviewed_at asc nulls last
  loop
    perform public.sello_capture_approved_act(v.id);
  end loop;
end $$;
comment on table public.sello_family_approval_acts is
 'Archivo privado de aprobaciones. La fila BORRADOR no constituye consentimiento ni prueba de verificación.';
