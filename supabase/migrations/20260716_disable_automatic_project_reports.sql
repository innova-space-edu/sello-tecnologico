-- Los informes pasan a ser creados manualmente por un integrante del grupo.
-- Esta migración NO elimina informes existentes ni su contenido.

begin;

drop trigger if exists create_report_after_project_insert on public.projects;
drop function if exists private.project_report_after_project_insert();

comment on table public.project_reports is
  'Informes colaborativos creados manualmente por estudiantes. El creador queda como jefe y agrega editores del mismo curso.';

commit;

notify pgrst, 'reload schema';
