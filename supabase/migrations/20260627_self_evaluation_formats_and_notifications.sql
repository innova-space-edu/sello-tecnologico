-- ================================================================
-- Formatos reutilizables y notificaciones de autoevaluación
-- Ejecutar después de 20260617_self_evaluations.sql y 20260604_user_notifications.sql.
-- ================================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.self_evaluation_formats (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  questions jsonb not null default '[]'::jsonb,
  source text not null default 'custom' check (source in ('copy','custom','imported')),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_self_evaluation_formats_active_created
  on public.self_evaluation_formats(active, created_at desc);

alter table public.self_evaluations
  add column if not exists format_id uuid references public.self_evaluation_formats(id) on delete set null;

create index if not exists idx_self_evaluations_format
  on public.self_evaluations(format_id, created_at desc);

alter table public.self_evaluation_formats enable row level security;

drop policy if exists self_evaluation_formats_select_active on public.self_evaluation_formats;
create policy self_evaluation_formats_select_active
on public.self_evaluation_formats for select to authenticated
using (active = true);

drop policy if exists self_evaluation_formats_manage_staff on public.self_evaluation_formats;
create policy self_evaluation_formats_manage_staff
on public.self_evaluation_formats for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','docente','coordinador')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','docente','coordinador')
  )
);

revoke all on table public.self_evaluation_formats from anon, authenticated;
grant select on table public.self_evaluation_formats to authenticated;
grant insert, update on table public.self_evaluation_formats to authenticated;

alter table public.user_notifications
  drop constraint if exists user_notifications_type_check;

alter table public.user_notifications
  add constraint user_notifications_type_check
  check (type in ('info','survey','followup','result','feedback','self_evaluation'));

alter table public.user_notifications
  drop constraint if exists user_notifications_source_type_check;

alter table public.user_notifications
  add constraint user_notifications_source_type_check
  check (source_type is null or source_type in ('survey','followup','system','self_evaluation'));

commit;
notify pgrst, 'reload schema';
