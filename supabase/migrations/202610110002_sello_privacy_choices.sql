-- Staged database changes: apply in non-production and verify first.
create table if not exists public.sello_privacy_choices (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version text not null, terms_acknowledged_at timestamptz not null default now(),
 choices jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
create table if not exists public.sello_privacy_choice_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 version text not null, choices jsonb not null, recorded_at timestamptz not null default now());
create index if not exists sello_privacy_choice_events_user_idx on public.sello_privacy_choice_events(user_id,recorded_at desc);
alter table public.sello_privacy_choices enable row level security;
alter table public.sello_privacy_choice_events enable row level security;
revoke all on public.sello_privacy_choices from public,anon,authenticated;
revoke all on public.sello_privacy_choice_events from public,anon,authenticated;
grant select on public.sello_privacy_choices to authenticated;
grant select on public.sello_privacy_choice_events to authenticated;
create policy "sello_read_my_privacy" on public.sello_privacy_choices for select to authenticated using (user_id=(select auth.uid()));
create policy "sello_read_my_privacy_events" on public.sello_privacy_choice_events for select to authenticated using (user_id=(select auth.uid()));
create or replace function public.record_sello_privacy_choices(
 p_policy_version text,p_terms_acknowledged boolean,p_choices jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid := auth.uid(); v_birth text; v_minor boolean := true;
begin
 if v_uid is null or p_policy_version is distinct from 'sello-2026-10-v1'
    or p_terms_acknowledged is distinct from true then
   raise exception 'Debes autenticarte y reconocer los términos actuales';
 end if;
 if p_choices is null or jsonb_typeof(p_choices) <> 'object' then
   raise exception 'Permisos inválidos';
 end if;
 if exists(select 1 from jsonb_each(p_choices) as i(key,val) where jsonb_typeof(i.val) <> 'boolean') then
   raise exception 'Las opciones requieren valor verdadero o falso';
 end if;
 if exists(select 1 from jsonb_object_keys(p_choices) as i(key) where i.key not in
 ('projects','evidences','images_internal','public_showcase','surveys','collaboration',
 'public_disclosure','ai_assistance','optional_analytics','educational_messages')) then
   raise exception 'Finalidad desconocida';
 end if;
 select raw_user_meta_data->>'birth_date' into v_birth from auth.users where id=v_uid;
 if v_birth ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
   begin
     v_minor := (v_birth::date > (current_date - interval '18 years')::date);
   exception when others then v_minor := true;
   end;
 end if;
 if v_minor and exists(select 1 from jsonb_each_text(p_choices) as i(key,val) where i.val='true') then
   raise exception 'El menor requiere decisiones del representante';
 end if;
 insert into public.sello_privacy_choices(user_id,version,terms_acknowledged_at,choices,updated_at)
 values(v_uid,p_policy_version,now(),p_choices,now())
 on conflict(user_id) do update set version=excluded.version,
 terms_acknowledged_at=excluded.terms_acknowledged_at,choices=excluded.choices,updated_at=excluded.updated_at;
 insert into public.sello_privacy_choice_events(user_id,version,choices)
 values(v_uid,p_policy_version,p_choices);
end $$;
revoke all on function public.record_sello_privacy_choices(text,boolean,jsonb) from public,anon;
grant execute on function public.record_sello_privacy_choices(text,boolean,jsonb) to authenticated;