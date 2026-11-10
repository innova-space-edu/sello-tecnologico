-- Encuestas de opinión de CreaLab (independientes de encuestas calificadas).
-- Solo los endpoints del servidor con usuario verificado usan service_role;
-- las respuestas del público nunca son consultables vía Data API del navegador.
create table if not exists public.online_surveys (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  slug text not null unique check (slug ~ '^[a-z0-9-]{10,80}$'),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 25),
  status text not null default 'pending_review'
    check (status in ('pending_review','published','closed','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.online_survey_submissions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.online_surveys(id) on delete cascade,
  respondent_token uuid not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  source_hash text,
  created_at timestamptz not null default now(),
  unique (survey_id, respondent_token)
);

create index if not exists online_surveys_creator_created_idx
  on public.online_surveys (creator_id, created_at desc);
create index if not exists online_surveys_status_created_idx
  on public.online_surveys (status, created_at desc);
create index if not exists online_survey_submissions_survey_created_idx
  on public.online_survey_submissions (survey_id, created_at desc);
create index if not exists online_survey_submissions_rate_idx
  on public.online_survey_submissions (survey_id, source_hash, created_at desc)
  where source_hash is not null;

alter table public.online_surveys enable row level security;
alter table public.online_survey_submissions enable row level security;
revoke all on public.online_surveys from public, anon, authenticated;
revoke all on public.online_survey_submissions from public, anon, authenticated;
grant select, insert, update, delete on public.online_surveys to service_role;
grant select, insert, update, delete on public.online_survey_submissions to service_role;

comment on table public.online_surveys is
 'Formularios públicos de proyectos CreaLab; la publicación de estudiantes requiere revisión.';
comment on table public.online_survey_submissions is
 'Respuestas anónimas, visibles solo para creador autorizado y administradores por API segura.';
