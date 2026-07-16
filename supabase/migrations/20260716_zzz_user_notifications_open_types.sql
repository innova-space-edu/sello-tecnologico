-- Conserva todos los tipos de notificación existentes y permite nuevos módulos.
-- Corrige ERROR 23514 al agregar project_report y report_rubric.

begin;

alter table if exists public.user_notifications
  drop constraint if exists user_notifications_type_check;

alter table if exists public.user_notifications
  drop constraint if exists user_notifications_source_type_check;

alter table public.user_notifications
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists dedupe_key text,
  add column if not exists is_read boolean not null default false,
  add column if not exists read_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.user_notifications
set type = 'info'
where type is null or btrim(type) = '';

update public.user_notifications
set dedupe_key = gen_random_uuid()::text
where dedupe_key is null or btrim(dedupe_key) = '';

alter table public.user_notifications
  alter column type set default 'info',
  alter column type set not null,
  alter column dedupe_key set default gen_random_uuid()::text,
  alter column dedupe_key set not null;

create unique index if not exists idx_user_notifications_dedupe_unique
  on public.user_notifications(dedupe_key);
create index if not exists idx_user_notifications_source
  on public.user_notifications(source_type, source_id);

commit;
notify pgrst, 'reload schema';
