-- Ruta guiada de proyectos STEAM.
-- Reutiliza public.projects y public.evidences, y agrega progreso, bitácora,
-- versiones y pruebas sin duplicar el sistema de proyectos existente.

begin;

create extension if not exists pgcrypto;

alter table public.projects
  add column if not exists steam_template_slug text,
  add column if not exists steam_route text,
  add column if not exists steam_mode text,
  add column if not exists steam_level text;

alter table public.evidences
  add column if not exists steam_phase_key text,
  add column if not exists steam_requirement_key text,
  add column if not exists steam_version_number integer;

create table if not exists public.steam_project_workspaces (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  template_slug text not null,
  route_type text not null check (route_type in ('scientific','engineering','digital','ai_data','mathematical','creative_social')),
  current_phase integer not null default 1 check (current_phase between 1 and 8),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  safety_status text not null default 'pending' check (safety_status in ('pending','submitted','approved','changes_requested','not_required')),
  safety_notes text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.steam_phase_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.steam_project_workspaces(id) on delete cascade,
  phase_number integer not null check (phase_number between 1 and 8),
  phase_key text not null,
  status text not null default 'not_started' check (status in ('not_started','in_progress','submitted','changes_requested','approved','completed')),
  content jsonb not null default '{}'::jsonb,
  student_reflection text,
  teacher_feedback text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, phase_number)
);

create table if not exists public.steam_journal_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.steam_project_workspaces(id) on delete cascade,
  phase_number integer not null check (phase_number between 1 and 8),
  author_id uuid not null references public.profiles(id) on delete cascade,
  work_done text not null,
  problem_found text,
  next_step text,
  teacher_comment text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.steam_prototype_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.steam_project_workspaces(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text not null,
  summary text,
  problems text,
  planned_changes text,
  applied_feedback text,
  result_summary text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, version_number)
);

create table if not exists public.steam_project_tests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.steam_project_workspaces(id) on delete cascade,
  version_number integer not null default 1 check (version_number > 0),
  criterion text not null,
  expected_result text,
  obtained_result text,
  unit text,
  passed boolean,
  observation text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_steam_workspaces_project on public.steam_project_workspaces(project_id);
create index if not exists idx_steam_workspaces_creator on public.steam_project_workspaces(created_by);
create index if not exists idx_steam_phase_workspace on public.steam_phase_entries(workspace_id, phase_number);
create index if not exists idx_steam_journal_workspace on public.steam_journal_entries(workspace_id, phase_number);
create index if not exists idx_steam_versions_workspace on public.steam_prototype_versions(workspace_id, version_number);
create index if not exists idx_steam_tests_workspace on public.steam_project_tests(workspace_id, version_number);
create index if not exists idx_evidences_steam_phase on public.evidences(project_id, steam_phase_key);

alter table public.steam_project_workspaces enable row level security;
alter table public.steam_phase_entries enable row level security;
alter table public.steam_journal_entries enable row level security;
alter table public.steam_prototype_versions enable row level security;
alter table public.steam_project_tests enable row level security;

-- Las decisiones de revisión no pueden ser falsificadas desde el cliente.
create or replace function public.enforce_steam_staff_review()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_staff boolean;
begin
  select exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('admin','docente','coordinador','utp')
  ) into is_staff;

  if tg_table_name = 'steam_phase_entries'
    and (
      old.status in ('approved','changes_requested')
      or new.status in ('approved','changes_requested')
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.teacher_feedback is distinct from old.teacher_feedback
    )
    and not is_staff
  then
    raise exception 'Solo el equipo docente puede registrar o modificar una revisión STEAM';
  end if;

  if tg_table_name = 'steam_project_workspaces'
    and new.safety_status is distinct from old.safety_status
    and new.safety_status in ('approved','changes_requested')
    and not is_staff
  then
    raise exception 'Solo el equipo docente puede aprobar la revisión de seguridad';
  end if;

  return new;
end;
$$;

drop trigger if exists steam_phase_staff_review_guard on public.steam_phase_entries;
create trigger steam_phase_staff_review_guard
before update on public.steam_phase_entries
for each row execute function public.enforce_steam_staff_review();

drop trigger if exists steam_safety_staff_review_guard on public.steam_project_workspaces;
create trigger steam_safety_staff_review_guard
before update on public.steam_project_workspaces
for each row execute function public.enforce_steam_staff_review();

-- Un usuario puede acceder a un espacio si es dueño del proyecto, colaborador
-- aceptado o integrante del equipo docente/directivo.
drop policy if exists "steam workspaces readable by participants" on public.steam_project_workspaces;
create policy "steam workspaces readable by participants"
on public.steam_project_workspaces for select to authenticated
using (
  exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  or exists (select 1 from public.project_collaborators pc where pc.project_id = project_id and pc.user_id = (select auth.uid()) and pc.status = 'accepted')
  or exists (select 1 from public.profiles pr where pr.id = (select auth.uid()) and pr.role in ('admin','docente','coordinador','utp'))
);

drop policy if exists "steam workspaces insert by project owner" on public.steam_project_workspaces;
create policy "steam workspaces insert by project owner"
on public.steam_project_workspaces for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
);

drop policy if exists "steam workspaces update by participants" on public.steam_project_workspaces;
create policy "steam workspaces update by participants"
on public.steam_project_workspaces for update to authenticated
using (
  exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  or exists (select 1 from public.project_collaborators pc where pc.project_id = project_id and pc.user_id = (select auth.uid()) and pc.status = 'accepted')
  or exists (select 1 from public.profiles pr where pr.id = (select auth.uid()) and pr.role in ('admin','docente','coordinador','utp'))
)
with check (
  exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  or exists (select 1 from public.project_collaborators pc where pc.project_id = project_id and pc.user_id = (select auth.uid()) and pc.status = 'accepted')
  or exists (select 1 from public.profiles pr where pr.id = (select auth.uid()) and pr.role in ('admin','docente','coordinador','utp'))
);

drop policy if exists "steam workspaces delete by owner or staff" on public.steam_project_workspaces;
create policy "steam workspaces delete by owner or staff"
on public.steam_project_workspaces for delete to authenticated
using (
  exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  or exists (select 1 from public.profiles pr where pr.id = (select auth.uid()) and pr.role in ('admin','docente','coordinador','utp'))
);

-- Tablas hijas: acceso heredado desde el espacio de trabajo.
drop policy if exists "steam phases readable by participants" on public.steam_phase_entries;
create policy "steam phases readable by participants"
on public.steam_phase_entries for select to authenticated
using (exists (select 1 from public.steam_project_workspaces w where w.id = workspace_id));

drop policy if exists "steam phases writable by participants" on public.steam_phase_entries;
create policy "steam phases writable by participants"
on public.steam_phase_entries for all to authenticated
using (exists (select 1 from public.steam_project_workspaces w where w.id = workspace_id))
with check (exists (select 1 from public.steam_project_workspaces w where w.id = workspace_id));

drop policy if exists "steam journal readable by participants" on public.steam_journal_entries;
create policy "steam journal readable by participants"
on public.steam_journal_entries for select to authenticated
using (exists (select 1 from public.steam_project_workspaces w where w.id = workspace_id));

drop policy if exists "steam journal insert by author" on public.steam_journal_entries;
create policy "steam journal insert by author"
on public.steam_journal_entries for insert to authenticated
with check (author_id = (select auth.uid()) and exists (select 1 from public.steam_project_workspaces w where w.id = workspace_id));

drop policy if exists "steam journal update by author or staff" on public.steam_journal_entries;
create policy "steam journal update by author or staff"
on public.steam_journal_entries for update to authenticated
using (
  author_id = (select auth.uid())
  or exists (select 1 from public.profiles pr where pr.id = (select auth.uid()) and pr.role in ('admin','docente','coordinador','utp'))
)
with check (
  author_id = (select auth.uid())
  or exists (select 1 from public.profiles pr where pr.id = (select auth.uid()) and pr.role in ('admin','docente','coordinador','utp'))
);

drop policy if exists "steam versions readable by participants" on public.steam_prototype_versions;
create policy "steam versions readable by participants"
on public.steam_prototype_versions for select to authenticated
using (exists (select 1 from public.steam_project_workspaces w where w.id = workspace_id));

drop policy if exists "steam versions writable by participants" on public.steam_prototype_versions;
create policy "steam versions writable by participants"
on public.steam_prototype_versions for all to authenticated
using (exists (select 1 from public.steam_project_workspaces w where w.id = workspace_id))
with check (created_by = (select auth.uid()) and exists (select 1 from public.steam_project_workspaces w where w.id = workspace_id));

drop policy if exists "steam tests readable by participants" on public.steam_project_tests;
create policy "steam tests readable by participants"
on public.steam_project_tests for select to authenticated
using (exists (select 1 from public.steam_project_workspaces w where w.id = workspace_id));

drop policy if exists "steam tests writable by participants" on public.steam_project_tests;
create policy "steam tests writable by participants"
on public.steam_project_tests for all to authenticated
using (exists (select 1 from public.steam_project_workspaces w where w.id = workspace_id))
with check (created_by = (select auth.uid()) and exists (select 1 from public.steam_project_workspaces w where w.id = workspace_id));

grant select, insert, update, delete on public.steam_project_workspaces to authenticated;
grant select, insert, update, delete on public.steam_phase_entries to authenticated;
grant select, insert, update, delete on public.steam_journal_entries to authenticated;
grant select, insert, update, delete on public.steam_prototype_versions to authenticated;
grant select, insert, update, delete on public.steam_project_tests to authenticated;
revoke all on function public.enforce_steam_staff_review() from public;

commit;
