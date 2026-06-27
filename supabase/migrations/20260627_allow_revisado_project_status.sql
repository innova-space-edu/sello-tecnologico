-- Permite usar el estado Revisado en proyectos.
-- Corrige el error: projects_status_check al actualizar estados desde /proyectos.

alter table public.projects drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check
  check (status = any (array[
    'Borrador'::text,
    'En progreso'::text,
    'En revisión'::text,
    'Revisado'::text,
    'Aprobado'::text,
    'Cerrado'::text
  ]));
