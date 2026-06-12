-- Estudiantes asignados a encuestas. Migración aditiva.
begin;

create table if not exists public.survey_students (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (survey_id, student_id)
);

create index if not exists idx_survey_students_survey
  on public.survey_students(survey_id);
create index if not exists idx_survey_students_student
  on public.survey_students(student_id);

alter table public.survey_students enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'survey_students'
      and policyname = 'survey_students_read_authorized'
  ) then
    create policy survey_students_read_authorized
    on public.survey_students
    for select to authenticated
    using (public.can_read_survey_results(survey_id));
  end if;
end
$$;

grant select (id, survey_id, student_id, created_at)
on public.survey_students to authenticated;

commit;
notify pgrst, 'reload schema';
