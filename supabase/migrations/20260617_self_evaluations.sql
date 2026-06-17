-- ================================================================
-- Módulo de autoevaluación STEAM
-- Permite que cada estudiante guarde su cuestionario y que docentes
-- o administración lo consulten por curso y nombre.
-- ================================================================

begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.self_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  student_name text not null,
  project_name text not null,
  intervention_place text not null,
  answers jsonb not null default '{}'::jsonb,
  confirmed boolean not null default false,
  status text not null default 'enviada' check (status in ('borrador', 'enviada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_self_evaluations_user
  on public.self_evaluations(user_id, created_at desc);
create index if not exists idx_self_evaluations_course
  on public.self_evaluations(course_id, created_at desc);
create index if not exists idx_self_evaluations_student_name
  on public.self_evaluations using gin (student_name gin_trgm_ops);

create or replace function public.can_read_self_evaluation(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.self_evaluations se
    where se.id = target_id
      and (
        se.user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin', 'docente')
        )
      )
  );
$$;

revoke all on function public.can_read_self_evaluation(uuid) from public;
grant execute on function public.can_read_self_evaluation(uuid) to authenticated;

alter table public.self_evaluations enable row level security;

drop policy if exists self_evaluations_insert_own on public.self_evaluations;
create policy self_evaluations_insert_own on public.self_evaluations
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists self_evaluations_read_authorized on public.self_evaluations;
create policy self_evaluations_read_authorized on public.self_evaluations
for select to authenticated
using (public.can_read_self_evaluation(id));

revoke all on table public.self_evaluations from anon, authenticated;
grant select, insert on table public.self_evaluations to authenticated;

commit;
notify pgrst, 'reload schema';
