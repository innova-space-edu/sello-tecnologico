-- Las políticas RLS invocan estas funciones seguras; authenticated requiere permiso de ejecución.
grant usage on schema private to authenticated;
grant execute on function private.is_project_report_staff() to authenticated;
grant execute on function private.can_read_project_report(uuid) to authenticated;
grant execute on function private.can_edit_project_report(uuid) to authenticated;
grant execute on function private.is_project_report_leader(uuid) to authenticated;
