-- Private account review, separate from personal declarations and guardian approvals.
create table if not exists public.sello_age_review_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,
 birth_date date not null,
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 evidence_ref text
);
create table if not exists public.sello_privacy_reviews (
 event_id bigint primary key references public.sello_privacy_choice_events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 version text not null,
 reviewer_id uuid not null references auth.users(id),
 decision text not null check(decision in ('approved','rejected')),
 reviewed_at timestamptz not null default now(),
 note text
);
create index if not exists sello_privacy_reviews_account_idx on public.sello_privacy_reviews(user_id,version,decision);
alter table public.sello_age_review_requests enable row level security;
alter table public.sello_privacy_reviews enable row level security;
revoke all on public.sello_age_review_requests,public.sello_privacy_reviews from public,anon,authenticated;
grant select,insert,update on public.sello_age_review_requests to service_role;
grant select,insert on public.sello_privacy_reviews to service_role;

-- A verified administrator can review missing age only with evidence and never their own.
create or replace function public.sello_review_missing_age(p_user uuid,p_reviewer uuid,p_approve boolean,p_evidence text)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.sello_age_review_requests%rowtype;
begin
 if p_user=p_reviewer or not exists(select 1 from public.profiles where id=p_reviewer and role='admin' and not coalesce(blocked,false)) or length(trim(coalesce(p_evidence,'')))<3 then
   raise exception 'Revisión independiente y respaldo requeridos';
 end if;
 select * into r from public.sello_age_review_requests where user_id=p_user for update;
 if not found or r.status<>'pending' then raise exception 'Solicitud no pendiente'; end if;
 if p_approve then
   insert into public.family_age_status(user_id,declared_birth_date,verified_at,verified_by)
   values(p_user,r.birth_date,now(),p_reviewer)
   on conflict(user_id) do update set declared_birth_date=excluded.declared_birth_date,verified_at=excluded.verified_at,verified_by=excluded.verified_by
   where public.family_age_status.declared_birth_date is null;
   if not found then raise exception 'La edad protegida ya está registrada'; end if;
 end if;
 update public.sello_age_review_requests set status=case when p_approve then 'approved' else 'rejected' end,
 reviewed_at=now(),reviewed_by=p_reviewer,evidence_ref=left(p_evidence,180) where user_id=p_user;
end $$;
revoke all on function public.sello_review_missing_age(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.sello_review_missing_age(uuid,uuid,boolean,text) to service_role;

-- NULL metadata must never count as acceptance; new registrations accept after login.
create or replace function public.sello_capture_initial_privacy()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_meta jsonb:=coalesce(new.raw_user_meta_data,'{}'::jsonb);
  v_choices jsonb:=v_meta->'sello_optional_choices_requested';
  v_birth date;
  v_minor boolean:=true;
  v_key text;
  v_values jsonb:='{}'::jsonb;
begin
  if v_meta->>'sello_terms_version' is distinct from 'sello-2026-10-v1' or
     v_meta->>'sello_terms_acknowledged' is distinct from 'true' then
    return new;
  end if;
  select declared_birth_date into v_birth from public.family_age_status where user_id=new.id;
  if v_birth is not null then
    v_minor:=v_birth>(current_date-interval '18 years')::date;
  end if;
  if pg_catalog.jsonb_typeof(v_choices) is distinct from 'object' then v_choices:='{}'::jsonb; end if;
  foreach v_key in array array['projects','evidences','images_internal','public_showcase','surveys','collaboration','public_disclosure','ai_assistance','optional_analytics','educational_messages']
  loop
    v_values:=v_values||pg_catalog.jsonb_build_object(
      v_key, case when not v_minor and v_choices->>v_key='true' then true else false end
    );
  end loop;
  insert into public.sello_privacy_choices(user_id,version,terms_acknowledged_at,choices,updated_at)
    values(new.id,'sello-2026-10-v1',now(),v_values,now())
    on conflict(user_id) do nothing;
  insert into public.sello_privacy_choice_events(user_id,version,choices,recorded_at)
    values(new.id,'sello-2026-10-v1',v_values,now());
  return new;
end $$;

