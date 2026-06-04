-- ================================================================
-- Módulo base de encuestas públicas con resultados restringidos
-- Ejecutar antes de 20260604_surveys_scoring.sql
-- ================================================================

create extension if not exists pgcrypto;

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  slug text not null unique,
  course_id uuid not null references public.courses(id) on delete restrict,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  allow_anonymous boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  prompt text not null,
  question_type text not null check (question_type in ('text', 'single', 'multiple', 'appreciation')),
  required boolean not null default false,
  sort_order integer not null default 0,
  options jsonb not null default '[]'::jsonb,
  appreciation_min_label text not null default 'Muy en desacuerdo',
  appreciation_max_label text not null default 'Muy de acuerdo',
  created_at timestamptz not null default now()
);

create table if not exists public.survey_course_staff (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (survey_id, teacher_id)
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  registered_user_id uuid references public.profiles(id) on delete set null,
  respondent_name text,
  respondent_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  value_text text,
  value_json jsonb,
  value_number numeric,
  created_at timestamptz not null default now(),
  unique (response_id, question_id)
);

create index if not exists idx_surveys_course on public.surveys(course_id);
create index if not exists idx_surveys_creator on public.surveys(creator_id);
create index if not exists idx_surveys_slug on public.surveys(slug);
create index if not exists idx_survey_questions_survey on public.survey_questions(survey_id, sort_order);
create index if not exists idx_survey_staff_teacher on public.survey_course_staff(teacher_id);
create index if not exists idx_survey_responses_survey on public.survey_responses(survey_id, created_at desc);
create index if not exists idx_survey_answers_response on public.survey_answers(response_id);

create or replace function public.can_read_survey_results(target_survey_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.surveys s
    where s.id = target_survey_id
      and (
        s.creator_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
        or exists (
          select 1 from public.survey_course_staff scs
          where scs.survey_id = s.id and scs.teacher_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.can_read_survey_results(uuid) from public;
grant execute on function public.can_read_survey_results(uuid) to authenticated;

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_course_staff enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers enable row level security;

-- La página pública solo puede leer encuestas activas.
drop policy if exists surveys_public_read_active on public.surveys;
create policy surveys_public_read_active on public.surveys
for select to anon, authenticated
using (is_active = true or public.can_read_survey_results(id));

-- La página pública solo puede leer preguntas pertenecientes a encuestas activas.
drop policy if exists survey_questions_public_read_active on public.survey_questions;
create policy survey_questions_public_read_active on public.survey_questions
for select to anon, authenticated
using (
  exists (
    select 1 from public.surveys s
    where s.id = survey_id and (s.is_active = true or public.can_read_survey_results(s.id))
  )
);

-- Solo personal autorizado puede leer asignaciones de docentes.
drop policy if exists survey_staff_read_authorized on public.survey_course_staff;
create policy survey_staff_read_authorized on public.survey_course_staff
for select to authenticated
using (teacher_id = auth.uid() or public.can_read_survey_results(survey_id));

-- Cualquier visitante puede responder únicamente una encuesta activa y usando su curso asociado.
drop policy if exists survey_responses_public_insert_active on public.survey_responses;
create policy survey_responses_public_insert_active on public.survey_responses
for insert to anon, authenticated
with check (
  exists (
    select 1 from public.surveys s
    where s.id = survey_id
      and s.is_active = true
      and s.course_id = course_id
      and (s.allow_anonymous = true or auth.uid() is not null)
  )
  and (registered_user_id is null or registered_user_id = auth.uid())
);

-- Los resultados solo pueden ser consultados por admin, creador o docentes autorizados.
drop policy if exists survey_responses_read_authorized on public.survey_responses;
create policy survey_responses_read_authorized on public.survey_responses
for select to authenticated
using (public.can_read_survey_results(survey_id));

-- Se permite insertar una respuesta por pregunta solo si pertenece a la encuesta de la respuesta.
drop policy if exists survey_answers_public_insert_valid on public.survey_answers;
create policy survey_answers_public_insert_valid on public.survey_answers
for insert to anon, authenticated
with check (
  exists (
    select 1
    from public.survey_responses sr
    join public.survey_questions sq on sq.survey_id = sr.survey_id
    join public.surveys s on s.id = sr.survey_id
    where sr.id = response_id
      and sq.id = question_id
      and s.is_active = true
  )
);

drop policy if exists survey_answers_read_authorized on public.survey_answers;
create policy survey_answers_read_authorized on public.survey_answers
for select to authenticated
using (
  exists (
    select 1 from public.survey_responses sr
    where sr.id = response_id and public.can_read_survey_results(sr.survey_id)
  )
);
