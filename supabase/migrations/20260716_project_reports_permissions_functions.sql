-- Funciones de autorización creadas antes de otorgar permisos y definir políticas finales.
create schema if not exists private;

create or replace function private.is_project_report_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','docente','coordinador','utp')
  );
$$;

create or replace function private.can_read_project_report(target_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select private.is_project_report_staff()
    or exists (
      select 1 from public.project_reports r
      where r.id = target_report_id and r.created_by = auth.uid()
    )
    or exists (
      select 1 from public.project_report_members m
      where m.report_id = target_report_id and m.user_id = auth.uid()
    );
$$;

create or replace function private.can_edit_project_report(target_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1 from public.project_reports r
    where r.id = target_report_id
      and r.status in ('draft','changes_requested')
      and (
        r.created_by = auth.uid()
        or exists (
          select 1 from public.project_report_members m
          where m.report_id = r.id and m.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function private.is_project_report_leader(target_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1 from public.project_reports r
    where r.id = target_report_id and r.created_by = auth.uid()
  );
$$;

revoke all on function private.is_project_report_staff() from public, anon, authenticated;
revoke all on function private.can_read_project_report(uuid) from public, anon, authenticated;
revoke all on function private.can_edit_project_report(uuid) from public, anon, authenticated;
revoke all on function private.is_project_report_leader(uuid) from public, anon, authenticated;
