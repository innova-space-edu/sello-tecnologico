-- Corrección final para informes creados manualmente por estudiantes.
-- Permite registrar al jefe inicial, limita colaboradores al mismo curso,
-- elimina la creación automática y habilita limpieza de borradores incompletos.

begin;

create schema if not exists private;

-- Los proyectos nuevos no deben generar informes automáticamente.
drop trigger if exists create_report_after_project_insert on public.projects;
drop function if exists private.project_report_after_project_insert();

create or replace function private.can_create_report_for_project(
  target_project_id uuid,
  target_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target_project_id
      and p.course_id is not distinct from target_course_id
      and (
        p.owner_id = auth.uid()
        or private.is_project_report_staff()
        or exists (
          select 1
          from public.project_collaborators pc
          where pc.project_id = p.id
            and pc.user_id = auth.uid()
            and pc.status = 'accepted'
        )
      )
  );
$$;

create or replace function private.is_report_course_member(
  target_report_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.project_reports r
    join public.course_members cm
      on cm.course_id = r.course_id
    where r.id = target_report_id
      and cm.user_id = target_user_id
  );
$$;

revoke all on function private.can_create_report_for_project(uuid, uuid) from public, anon, authenticated;
revoke all on function private.is_report_course_member(uuid, uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.can_create_report_for_project(uuid, uuid) to authenticated;
grant execute on function private.is_report_course_member(uuid, uuid) to authenticated;

-- Solo el propietario o un colaborador aceptado puede iniciar el informe.
drop policy if exists reports_create_owner on public.project_reports;
create policy reports_create_owner on public.project_reports
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.can_create_report_for_project(project_id, course_id)
);

-- El creador puede borrar únicamente un borrador propio, útil si falla la
-- creación de integrantes o bloques y se necesita revertir la operación.
drop policy if exists reports_delete_owner_draft on public.project_reports;
create policy reports_delete_owner_draft on public.project_reports
for delete to authenticated
using (
  created_by = auth.uid()
  and status = 'draft'
);

-- Permitir la fila inicial del jefe y luego solo editores del mismo curso.
drop policy if exists report_members_manage_leader on public.project_report_members;
create policy report_members_manage_leader on public.project_report_members
for insert to authenticated
with check (
  private.is_project_report_leader(report_id)
  and added_by = auth.uid()
  and (
    (
      member_role = 'leader'
      and user_id = auth.uid()
    )
    or (
      member_role = 'editor'
      and user_id <> auth.uid()
      and private.is_report_course_member(report_id, user_id)
    )
  )
);

-- Sincronizar altas y bajas de integrantes entre usuarios conectados.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_report_members'
  ) then
    alter publication supabase_realtime add table public.project_report_members;
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
