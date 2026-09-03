create table if not exists public.promedios_workbooks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  course_id uuid null references public.courses(id) on delete set null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  original_filename text not null default 'promedios.xlsx',
  display_mode text not null default 'alias' check (display_mode in ('name','alias')),
  editor_key text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_saved_at timestamptz null,
  archived_at timestamptz null
);

create index if not exists promedios_workbooks_owner_idx on public.promedios_workbooks(owner_id, updated_at desc);
create index if not exists promedios_workbooks_course_idx on public.promedios_workbooks(course_id, updated_at desc);

create table if not exists public.promedios_workbook_versions (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.promedios_workbooks(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  storage_path text not null unique,
  saved_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workbook_id, version_no)
);
create index if not exists promedios_versions_workbook_idx on public.promedios_workbook_versions(workbook_id, version_no desc);

create table if not exists public.promedios_aliases (
  workbook_id uuid not null references public.promedios_workbooks(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  primary key (workbook_id, student_id),
  unique (workbook_id, alias)
);

create table if not exists public.promedios_editor_sessions (
  token uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.promedios_workbooks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists promedios_editor_sessions_expiry_idx on public.promedios_editor_sessions(expires_at);

alter table public.promedios_workbooks enable row level security;
alter table public.promedios_workbook_versions enable row level security;
alter table public.promedios_aliases enable row level security;
alter table public.promedios_editor_sessions enable row level security;

revoke all on table public.promedios_workbooks from anon, authenticated;
revoke all on table public.promedios_workbook_versions from anon, authenticated;
revoke all on table public.promedios_aliases from anon, authenticated;
revoke all on table public.promedios_editor_sessions from anon, authenticated;

grant select, insert, update, delete on table public.promedios_workbooks to service_role;
grant select, insert, update, delete on table public.promedios_workbook_versions to service_role;
grant select, insert, update, delete on table public.promedios_aliases to service_role;
grant select, insert, update, delete on table public.promedios_editor_sessions to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'promedios-workbooks',
  'promedios-workbooks',
  false,
  52428800,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
