-- Libro de calificaciones nativo (reemplaza el flujo centrado en archivos Excel).
-- Mantiene las tablas antiguas para compatibilidad/historial, pero la nueva UI usa estas entidades.

create table if not exists public.promedios_gradebooks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 1 and 120),
  period text not null default '1S' check (period in ('1S','2S')),
  school_year integer not null default extract(year from current_date)::integer check (school_year between 2020 and 2100),
  passing_percent numeric(5,2) not null default 60 check (passing_percent > 0 and passing_percent < 100),
  min_grade numeric(3,1) not null default 1.0 check (min_grade = 1.0),
  max_grade numeric(3,1) not null default 7.0 check (max_grade = 7.0),
  passing_grade numeric(3,1) not null default 4.0 check (passing_grade = 4.0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, owner_id, subject, period, school_year)
);

create index if not exists promedios_gradebooks_course_idx
  on public.promedios_gradebooks(course_id, owner_id, school_year, period);

create table if not exists public.promedios_assessments (
  id uuid primary key default gen_random_uuid(),
  gradebook_id uuid not null references public.promedios_gradebooks(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  kind text not null default 'parcial'
    check (kind in ('parcial','acumulativa','sumativa','formativa','diagnostica','otra')),
  entry_mode text not null default 'grade'
    check (entry_mode in ('grade','points','percent')),
  max_points numeric(10,2) null check (max_points is null or max_points > 0),
  passing_percent numeric(5,2) null check (passing_percent is null or (passing_percent > 0 and passing_percent < 100)),
  weight numeric(8,3) not null default 1 check (weight > 0),
  counts_toward_average boolean not null default true,
  assessment_date date null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promedios_assessments_gradebook_idx
  on public.promedios_assessments(gradebook_id, sort_order, created_at);

create table if not exists public.promedios_grades (
  assessment_id uuid not null references public.promedios_assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  grade numeric(3,1) null check (grade is null or (grade >= 1.0 and grade <= 7.0)),
  raw_score numeric(10,2) null check (raw_score is null or raw_score >= 0),
  status text not null default 'normal'
    check (status in ('normal','ausente','justificado','eximido','pendiente')),
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (assessment_id, student_id)
);

create index if not exists promedios_grades_student_idx
  on public.promedios_grades(student_id, assessment_id);

alter table public.promedios_gradebooks enable row level security;
alter table public.promedios_assessments enable row level security;
alter table public.promedios_grades enable row level security;

revoke all on table public.promedios_gradebooks from anon, authenticated;
revoke all on table public.promedios_assessments from anon, authenticated;
revoke all on table public.promedios_grades from anon, authenticated;

grant select, insert, update, delete on table public.promedios_gradebooks to service_role;
grant select, insert, update, delete on table public.promedios_assessments to service_role;
grant select, insert, update, delete on table public.promedios_grades to service_role;
