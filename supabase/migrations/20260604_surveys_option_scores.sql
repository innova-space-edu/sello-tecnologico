-- ================================================================
-- Puntaje independiente por alternativa
-- Ejecutar después de:
-- 1. 20260604_surveys.sql
-- 2. 20260604_surveys_scoring.sql
-- 3. 20260604_surveys_teacher_admin_only.sql
-- ================================================================

alter table public.survey_questions
  add column if not exists option_scores jsonb not null default '{}'::jsonb;

-- Convierte pautas anteriores a puntajes por alternativa.
-- Alternativa única: la respuesta correcta conserva el puntaje máximo.
-- Selección múltiple: el puntaje máximo se distribuye equitativamente entre
-- las alternativas previamente marcadas como correctas.
update public.survey_questions sq
set option_scores = case
  when sq.question_type = 'single' then (
    select coalesce(jsonb_object_agg(option_row.value, case when sq.correct_answers ? option_row.value then sq.max_points else 0 end), '{}'::jsonb)
    from jsonb_array_elements_text(coalesce(sq.options, '[]'::jsonb)) as option_row(value)
  )
  when sq.question_type = 'multiple' then (
    select coalesce(jsonb_object_agg(option_row.value,
      case
        when sq.correct_answers ? option_row.value and jsonb_array_length(coalesce(sq.correct_answers, '[]'::jsonb)) > 0
          then round(sq.max_points / jsonb_array_length(sq.correct_answers), 2)
        else 0
      end
    ), '{}'::jsonb)
    from jsonb_array_elements_text(coalesce(sq.options, '[]'::jsonb)) as option_row(value)
  )
  else '{}'::jsonb
end
where sq.option_scores = '{}'::jsonb;

create or replace function public.score_survey_answer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  question_record record;
  selected_answers jsonb;
  selected_option text;
  accumulated numeric := 0;
begin
  select question_type, max_points, option_scores
  into question_record
  from public.survey_questions
  where id = new.question_id;

  if not found then
    raise exception 'Pregunta inexistente';
  end if;

  new.awarded_points := 0;

  if question_record.question_type = 'single' then
    selected_option := coalesce(new.value_text, '');
    new.awarded_points := least(
      question_record.max_points,
      greatest(0, coalesce((question_record.option_scores ->> selected_option)::numeric, 0))
    );

  elsif question_record.question_type = 'multiple' then
    selected_answers := coalesce(new.value_json, '[]'::jsonb);
    if jsonb_typeof(selected_answers) = 'array' then
      select coalesce(sum(greatest(0, coalesce((question_record.option_scores ->> selected.value)::numeric, 0))), 0)
      into accumulated
      from jsonb_array_elements_text(selected_answers) as selected(value);
      new.awarded_points := least(question_record.max_points, accumulated);
    end if;

  elsif question_record.question_type = 'appreciation' then
    if new.value_number is not null then
      new.awarded_points := round(question_record.max_points * greatest(1, least(new.value_number, 5)) / 5.0, 2);
    end if;

  elsif question_record.question_type = 'text' then
    if length(trim(coalesce(new.value_text, ''))) > 0 then
      new.awarded_points := question_record.max_points;
    end if;
  end if;

  return new;
end;
$$;

-- Recalcula respuestas existentes usando el nuevo esquema.
update public.survey_answers
set value_text = value_text,
    value_json = value_json,
    value_number = value_number;

-- El formulario público no puede leer puntajes internos por alternativa.
-- No existe un GRANT de tabla completa; se mantiene únicamente la selección
-- de columnas públicas definida en 20260604_surveys.sql.
revoke select (option_scores) on public.survey_questions from anon, authenticated;
