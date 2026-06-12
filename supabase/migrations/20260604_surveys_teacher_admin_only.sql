-- ================================================================
-- Restringe resultados de encuestas exclusivamente a docentes y admin.
-- Ejecutar después de 20260604_surveys.sql y 20260604_surveys_scoring.sql.
-- ================================================================

create or replace function public.can_read_survey_results(target_survey_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'docente')
      and (
        p.role = 'admin'
        or exists (
          select 1
          from public.surveys s
          where s.id = target_survey_id
            and (
              s.creator_id = auth.uid()
              or exists (
                select 1
                from public.survey_course_staff scs
                where scs.survey_id = s.id
                  and scs.teacher_id = auth.uid()
              )
            )
        )
      )
  );
$$;

revoke all on function public.can_read_survey_results(uuid) from public;
grant execute on function public.can_read_survey_results(uuid) to anon, authenticated;
