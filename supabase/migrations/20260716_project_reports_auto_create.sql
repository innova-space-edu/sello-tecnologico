-- Creación automática de informes para proyectos nuevos y existentes.
create schema if not exists private;

create or replace function private.create_project_report(target_project_id uuid, target_title text, target_course_id uuid, target_owner_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  report_uuid uuid;
begin
  if target_owner_id is null then return null; end if;

  insert into public.project_reports (project_id, course_id, created_by, title, status, autosave_seconds)
  values (target_project_id, target_course_id, target_owner_id, 'Informe final: ' || coalesce(target_title, 'Proyecto'), 'draft', 5)
  on conflict (project_id) do update set course_id = excluded.course_id
  returning id into report_uuid;

  insert into public.project_report_members (report_id, user_id, member_role, added_by)
  values (report_uuid, target_owner_id, 'leader', target_owner_id)
  on conflict (report_id, user_id) do update set member_role = 'leader';

  if not exists (select 1 from public.project_report_sections where report_id = report_uuid) then
    insert into public.project_report_sections
      (report_id, section_type, title, content, student_example, teacher_example, sort_order, created_by, updated_by)
    values
      (report_uuid, 'summary', '1. Resumen del proyecto', '{"text":""}'::jsonb,
       'Ejemplo: Nuestro proyecto buscó reducir los residuos plásticos del colegio mediante puntos limpios, una campaña informativa y mediciones semanales.',
       'Revisar que el resumen explique problema, solución, participantes y resultado principal en un texto breve.', 0, target_owner_id, target_owner_id),
      (report_uuid, 'problem', '2. Problema o necesidad detectada', '{"text":""}'::jsonb,
       'Ejemplo: Observamos que en los recreos se acumulaban botellas y envoltorios porque no existían contenedores diferenciados ni información visible.',
       'Verificar que el problema esté respaldado por observaciones, registros, fotografías, encuestas u otra evidencia.', 1, target_owner_id, target_owner_id),
      (report_uuid, 'objectives', '3. Objetivos', '{"text":""}'::jsonb,
       'Ejemplo: Objetivo general: disminuir los residuos mezclados. Objetivos específicos: instalar tres puntos limpios, informar a los cursos y comparar datos antes y después.',
       'Comprobar que los objetivos sean claros, medibles y coherentes con las actividades ejecutadas.', 2, target_owner_id, target_owner_id),
      (report_uuid, 'methodology', '4. Metodología y organización del equipo', '{"text":""}'::jsonb,
       'Ejemplo: Dividimos el trabajo en diagnóstico, diseño, implementación y evaluación. Cada integrante asumió una función y registramos avances semanalmente.',
       'Solicitar que expliquen etapas, responsabilidades, instrumentos, participantes y forma de recopilación de datos.', 3, target_owner_id, target_owner_id),
      (report_uuid, 'resources', '5. Evidencias, imágenes y recursos utilizados', '{"text":"","resources":[]}'::jsonb,
       'Ejemplo: Agregar fotografías del proceso, videos, documentos, enlaces y evidencias ya subidas al proyecto desde la biblioteca lateral.',
       'Evaluar pertinencia, calidad, identificación y relación de cada recurso con el avance descrito.', 4, target_owner_id, target_owner_id),
      (report_uuid, 'survey', '6. Encuestas y participación de la comunidad', '{"text":"","resources":[]}'::jsonb,
       'Ejemplo: Respondieron 84 estudiantes. El 72% indicó que usaría los puntos limpios si estuvieran claramente señalizados.',
       'Revisar tamaño de la muestra, preguntas utilizadas, lectura de resultados y conclusiones justificadas.', 5, target_owner_id, target_owner_id),
      (report_uuid, 'results', '7. Resultados y análisis', '{"text":"","table":[["Indicador","Antes","Después"],["Ejemplo","12","31"]]}'::jsonb,
       'Ejemplo: Los residuos separados aumentaron de 12 kg a 31 kg por semana. La mayor mejora se observó después de las charlas.',
       'Comprobar que distingan resultados de opiniones y que interpreten tablas, gráficos o comparaciones.', 6, target_owner_id, target_owner_id),
      (report_uuid, 'impact', '8. Impacto en la comunidad', '{"text":""}'::jsonb,
       'Ejemplo: Participaron cuatro cursos, se incorporó una rutina de retiro semanal y el centro de estudiantes asumió la continuidad.',
       'Valorar beneficiarios, cambios observables, alcance, limitaciones y continuidad del proyecto.', 7, target_owner_id, target_owner_id),
      (report_uuid, 'conclusions', '9. Conclusiones, dificultades y mejoras', '{"text":""}'::jsonb,
       'Ejemplo: La solución funcionó, pero faltó señalética en dos sectores. Recomendamos ampliar los puntos y repetir la medición durante otro mes.',
       'Revisar que las conclusiones respondan a los objetivos y que las mejoras sean realistas y específicas.', 8, target_owner_id, target_owner_id),
      (report_uuid, 'references', '10. Referencias y anexos', '{"text":"","resources":[]}'::jsonb,
       'Ejemplo: Indicar fuentes consultadas, entrevistas, documentos, enlaces y materiales anexos.',
       'Comprobar identificación de fuentes, autoría y relación de los anexos con el informe.', 9, target_owner_id, target_owner_id);
  end if;

  return report_uuid;
end;
$$;

revoke all on function private.create_project_report(uuid, text, uuid, uuid) from public, anon, authenticated;

create or replace function private.project_report_after_project_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.create_project_report(new.id, new.title, new.course_id, new.owner_id);
  return new;
end;
$$;

revoke all on function private.project_report_after_project_insert() from public, anon, authenticated;

drop trigger if exists create_report_after_project_insert on public.projects;
create trigger create_report_after_project_insert
after insert on public.projects
for each row execute function private.project_report_after_project_insert();

-- Crear inmediatamente los informes faltantes de proyectos existentes.
do $$
declare
  p record;
begin
  for p in select id, title, course_id, owner_id from public.projects where owner_id is not null loop
    perform private.create_project_report(p.id, p.title, p.course_id, p.owner_id);
  end loop;
end;
$$;
