-- Restore the initial acceptance timestamp when a user edits only optional preferences.
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
 select declared_birth_date::text into v_birth from public.family_age_status where user_id=v_uid;
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
 terms_acknowledged_at=case when public.sello_privacy_choices.version=excluded.version
   then public.sello_privacy_choices.terms_acknowledged_at
   else excluded.terms_acknowledged_at end,
 choices=excluded.choices,updated_at=excluded.updated_at;
 insert into public.sello_privacy_choice_events(user_id,version,choices)
 values(v_uid,p_policy_version,p_choices);
end $$;

revoke all on function public.record_sello_privacy_choices(text,boolean,jsonb) from public,anon;
grant execute on function public.record_sello_privacy_choices(text,boolean,jsonb) to authenticated;

-- Preserve the signup declaration even if Supabase requires email verification before session.
-- Sign-up metadata is a record of declared consent, not identity verification.
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
  if v_meta->>'sello_terms_version'<>'sello-2026-10-v1' or
     v_meta->>'sello_terms_acknowledged'<>'true' then
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
revoke all on function public.sello_capture_initial_privacy() from public,anon,authenticated;
drop trigger if exists zz_sello_initial_privacy_signup on auth.users;
-- Alphabetical trigger execution follows family_capture_age_insert.
create trigger zz_sello_initial_privacy_signup after insert on auth.users
for each row execute function public.sello_capture_initial_privacy();
