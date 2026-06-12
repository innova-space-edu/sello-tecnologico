-- ================================================================
-- Avisos personales para encuestas y seguimientos
-- Ejecutar después de las migraciones del módulo de encuestas.
-- ================================================================

begin;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info'
    check (type in ('info','survey','followup','result','feedback')),
  source_type text
    check (source_type is null or source_type in ('survey','followup','system')),
  source_id uuid,
  dedupe_key text not null unique,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_notifications_user_created
  on public.user_notifications(user_id, created_at desc);
create index if not exists idx_user_notifications_user_unread
  on public.user_notifications(user_id, is_read);
create index if not exists idx_user_notifications_source
  on public.user_notifications(source_type, source_id);

alter table public.survey_responses
  add column if not exists feedback text,
  add column if not exists feedback_updated_at timestamptz,
  add column if not exists results_visible boolean not null default true;

alter table public.user_notifications enable row level security;

drop policy if exists user_notifications_select_own on public.user_notifications;
create policy user_notifications_select_own
on public.user_notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists user_notifications_update_own on public.user_notifications;
create policy user_notifications_update_own
on public.user_notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select on public.user_notifications to authenticated;
grant update (is_read, read_at) on public.user_notifications to authenticated;

drop policy if exists survey_students_select_own on public.survey_students;
create policy survey_students_select_own
on public.survey_students for select to authenticated
using (student_id = auth.uid());

drop policy if exists survey_responses_select_own on public.survey_responses;
create policy survey_responses_select_own
on public.survey_responses for select to authenticated
using (registered_user_id = auth.uid() and results_visible = true);

drop policy if exists survey_answers_select_own on public.survey_answers;
create policy survey_answers_select_own
on public.survey_answers for select to authenticated
using (
  exists (
    select 1 from public.survey_responses sr
    where sr.id = response_id
      and sr.registered_user_id = auth.uid()
      and sr.results_visible = true
  )
);

create or replace function public.upsert_user_notification(
  target_user_id uuid,
  notification_title text,
  notification_message text,
  notification_type text,
  notification_source_type text,
  notification_source_id uuid,
  notification_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_notifications (
    user_id, title, message, type, source_type, source_id,
    dedupe_key, is_read, read_at, created_at, updated_at
  ) values (
    target_user_id, notification_title, notification_message,
    notification_type, notification_source_type,
    notification_source_id, notification_dedupe_key,
    false, null, now(), now()
  )
  on conflict (dedupe_key) do update set
    title = excluded.title,
    message = excluded.message,
    type = excluded.type,
    source_type = excluded.source_type,
    source_id = excluded.source_id,
    is_read = false,
    read_at = null,
    updated_at = now();
end;
$$;

create or replace function public.notify_survey_student_assignment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare survey_title text;
begin
  select title into survey_title from public.surveys where id = new.survey_id;
  perform public.upsert_user_notification(
    new.student_id,
    'Nueva encuesta asignada',
    'Tienes una nueva encuesta disponible: ' || coalesce(survey_title, 'Encuesta'),
    'survey', 'survey', new.survey_id,
    'survey:assigned:' || new.survey_id::text || ':' || new.student_id::text
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_survey_student_assignment on public.survey_students;
create trigger trg_notify_survey_student_assignment
after insert on public.survey_students
for each row execute function public.notify_survey_student_assignment();

create or replace function public.notify_followup_participant_assignment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare project_title text;
begin
  select p.title into project_title
  from public.project_followups pf
  left join public.projects p on p.id = pf.project_id
  where pf.id = new.followup_id;
  perform public.upsert_user_notification(
    new.user_id,
    'Nuevo seguimiento asignado',
    'Tienes una nueva evaluación de seguimiento' ||
      case when project_title is null then '.' else ' para el proyecto: ' || project_title end,
    'followup', 'followup', new.followup_id,
    'followup:assigned:' || new.followup_id::text || ':' || new.user_id::text
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_followup_participant_assignment on public.followup_participants;
create trigger trg_notify_followup_participant_assignment
after insert on public.followup_participants
for each row execute function public.notify_followup_participant_assignment();

create or replace function public.notify_followup_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare participant record; project_title text;
begin
  if new.score is distinct from old.score
     or new.feedback is distinct from old.feedback
     or new.overall_status is distinct from old.overall_status then
    select title into project_title from public.projects where id = new.project_id;
    for participant in select user_id from public.followup_participants where followup_id = new.id loop
      perform public.upsert_user_notification(
        participant.user_id,
        'Seguimiento actualizado',
        'Se actualizó tu seguimiento' || case when project_title is null then '.' else ' del proyecto: ' || project_title end,
        case when new.feedback is distinct from old.feedback then 'feedback' else 'result' end,
        'followup', new.id,
        'followup:updated:' || new.id::text || ':' || participant.user_id::text
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_followup_update on public.project_followups;
create trigger trg_notify_followup_update
after update of score, feedback, overall_status on public.project_followups
for each row execute function public.notify_followup_update();

create or replace function public.notify_survey_response_result()
returns trigger language plpgsql security definer set search_path = public
as $$
declare survey_title text;
begin
  if new.registered_user_id is not null
     and new.results_visible = true
     and (new.grade is distinct from old.grade
       or new.earned_points is distinct from old.earned_points
       or new.feedback is distinct from old.feedback) then
    select title into survey_title from public.surveys where id = new.survey_id;
    perform public.upsert_user_notification(
      new.registered_user_id,
      case when new.feedback is distinct from old.feedback then 'Nueva retroalimentación de encuesta' else 'Resultado de encuesta disponible' end,
      coalesce(survey_title, 'Encuesta') || ' · Nota ' || coalesce(new.grade::text, '—') || ' · ' || coalesce(new.achievement_percent::text, '0') || '% de logro.',
      case when new.feedback is distinct from old.feedback then 'feedback' else 'result' end,
      'survey', new.survey_id,
      'survey:result:' || new.survey_id::text || ':' || new.registered_user_id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_survey_response_result on public.survey_responses;
create trigger trg_notify_survey_response_result
after update of grade, earned_points, achievement_percent, feedback, results_visible
on public.survey_responses
for each row execute function public.notify_survey_response_result();

insert into public.user_notifications (user_id,title,message,type,source_type,source_id,dedupe_key)
select ss.student_id, 'Encuesta asignada', 'Tienes una encuesta disponible: ' || s.title,
  'survey', 'survey', ss.survey_id,
  'survey:assigned:' || ss.survey_id::text || ':' || ss.student_id::text
from public.survey_students ss
join public.surveys s on s.id = ss.survey_id
on conflict (dedupe_key) do nothing;

insert into public.user_notifications (user_id,title,message,type,source_type,source_id,dedupe_key)
select fp.user_id, 'Seguimiento asignado', 'Tienes una evaluación de seguimiento disponible.',
  'followup', 'followup', fp.followup_id,
  'followup:assigned:' || fp.followup_id::text || ':' || fp.user_id::text
from public.followup_participants fp
on conflict (dedupe_key) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end
$$;

commit;
notify pgrst, 'reload schema';
