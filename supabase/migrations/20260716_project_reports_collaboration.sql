-- Informes colaborativos de proyectos
create extension if not exists pgcrypto;

create table if not exists public.project_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft','submitted','in_review','changes_requested','evaluated','finalized')),
  autosave_seconds integer not null default 5 check (autosave_seconds between 3 and 60),
  submitted_at timestamptz,
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id)
);

create table if not exists public.project_report_members (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.project_reports(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'editor' check (member_role in ('leader','editor')),
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(report_id, user_id)
);

create table if not exists public.project_report_sections (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.project_reports(id) on delete cascade,
  section_type text not null default 'text',
  title text not null,
  content jsonb not null default '{}'::jsonb,
  student_example text,
  teacher_example text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.project_reports(id) on delete cascade,
  section_id uuid references public.project_report_sections(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.project_report_rubrics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  total_points numeric(10,2) not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_report_rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.project_report_rubrics(id) on delete cascade,
  title text not null,
  description text,
  max_points numeric(10,2) not null check (max_points > 0),
  student_example text,
  teacher_example text,
  sort_order integer not null default 0
);

create table if not exists public.project_report_evaluations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.project_reports(id) on delete cascade,
  rubric_id uuid references public.project_report_rubrics(id) on delete set null,
  evaluator_id uuid not null references public.profiles(id) on delete cascade,
  total_points numeric(10,2) not null default 0,
  earned_points numeric(10,2) not null default 0,
  final_grade numeric(3,1),
  general_feedback text,
  calculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(report_id)
);

create table if not exists public.project_report_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.project_report_evaluations(id) on delete cascade,
  criterion_id uuid not null references public.project_report_rubric_criteria(id) on delete cascade,
  score numeric(10,2) not null default 0,
  feedback text,
  unique(evaluation_id, criterion_id)
);

create index if not exists idx_project_reports_project on public.project_reports(project_id);
create index if not exists idx_project_reports_course on public.project_reports(course_id);
create index if not exists idx_report_members_report on public.project_report_members(report_id);
create index if not exists idx_report_members_user on public.project_report_members(user_id);
create index if not exists idx_report_sections_report on public.project_report_sections(report_id, sort_order);
create index if not exists idx_report_comments_section on public.project_report_comments(section_id, created_at);
create index if not exists idx_report_rubrics_course on public.project_report_rubrics(course_id);

alter table public.project_reports enable row level security;
alter table public.project_report_members enable row level security;
alter table public.project_report_sections enable row level security;
alter table public.project_report_comments enable row level security;
alter table public.project_report_rubrics enable row level security;
alter table public.project_report_rubric_criteria enable row level security;
alter table public.project_report_evaluations enable row level security;
alter table public.project_report_scores enable row level security;

grant select, insert, update, delete on public.project_reports to authenticated;
grant select, insert, update, delete on public.project_report_members to authenticated;
grant select, insert, update, delete on public.project_report_sections to authenticated;
grant select, insert, update, delete on public.project_report_comments to authenticated;
grant select, insert, update, delete on public.project_report_rubrics to authenticated;
grant select, insert, update, delete on public.project_report_rubric_criteria to authenticated;
grant select, insert, update, delete on public.project_report_evaluations to authenticated;
grant select, insert, update, delete on public.project_report_scores to authenticated;

-- Todos los docentes y personal de gestión pueden ver todos los informes.
create policy reports_read_visible on public.project_reports for select to authenticated using (
  created_by = (select auth.uid())
  or exists (select 1 from public.project_report_members m where m.report_id = id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
);
create policy reports_create_owner on public.project_reports for insert to authenticated with check (created_by = (select auth.uid()));
create policy reports_update_team_or_staff on public.project_reports for update to authenticated using (
  created_by = (select auth.uid())
  or exists (select 1 from public.project_report_members m where m.report_id = id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
) with check (
  created_by = (select auth.uid())
  or exists (select 1 from public.project_report_members m where m.report_id = id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
);

create policy report_members_read on public.project_report_members for select to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.project_reports r where r.id = report_id)
);
create policy report_members_manage_leader on public.project_report_members for insert to authenticated with check (
  added_by = (select auth.uid()) and exists (select 1 from public.project_reports r where r.id = report_id and r.created_by = (select auth.uid()))
);
create policy report_members_delete_leader on public.project_report_members for delete to authenticated using (
  exists (select 1 from public.project_reports r where r.id = report_id and r.created_by = (select auth.uid()))
);

create policy report_sections_read on public.project_report_sections for select to authenticated using (exists (select 1 from public.project_reports r where r.id = report_id));
create policy report_sections_write on public.project_report_sections for all to authenticated using (
  exists (select 1 from public.project_reports r where r.id = report_id and (
    r.created_by = (select auth.uid()) or exists (select 1 from public.project_report_members m where m.report_id = r.id and m.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
  ))
) with check (
  exists (select 1 from public.project_reports r where r.id = report_id and (
    r.created_by = (select auth.uid()) or exists (select 1 from public.project_report_members m where m.report_id = r.id and m.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
  ))
);

create policy report_comments_read on public.project_report_comments for select to authenticated using (exists (select 1 from public.project_reports r where r.id = report_id));
create policy report_comments_insert on public.project_report_comments for insert to authenticated with check (author_id = (select auth.uid()) and exists (select 1 from public.project_reports r where r.id = report_id));
create policy report_comments_update on public.project_report_comments for update to authenticated using (
  author_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
) with check (
  author_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
);

create policy rubrics_read on public.project_report_rubrics for select to authenticated using (
  published = true or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
);
create policy rubrics_staff_write on public.project_report_rubrics for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
) with check (
  created_by = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
);
create policy criteria_read on public.project_report_rubric_criteria for select to authenticated using (exists (select 1 from public.project_report_rubrics r where r.id = rubric_id));
create policy criteria_staff_write on public.project_report_rubric_criteria for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
) with check (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
);

create policy evaluations_read on public.project_report_evaluations for select to authenticated using (exists (select 1 from public.project_reports r where r.id = report_id));
create policy evaluations_staff_write on public.project_report_evaluations for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
) with check (
  evaluator_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
);
create policy scores_read on public.project_report_scores for select to authenticated using (exists (select 1 from public.project_report_evaluations e where e.id = evaluation_id));
create policy scores_staff_write on public.project_report_scores for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
) with check (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','docente','coordinador','utp'))
);

-- Realtime para colaboración, presencia y actualización de bloques.
alter publication supabase_realtime add table public.project_reports;
alter publication supabase_realtime add table public.project_report_sections;
alter publication supabase_realtime add table public.project_report_comments;
