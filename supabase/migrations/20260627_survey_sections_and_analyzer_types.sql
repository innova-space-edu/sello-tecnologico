-- ================================================================
-- Encuestas editables con secciones, listas de cotejo y escalas
-- Ejecutar después de 20260604_surveys.sql y 20260604_surveys_scoring.sql.
-- ================================================================

begin;

alter table public.survey_questions
  add column if not exists section text not null default 'General';

create index if not exists idx_survey_questions_section_order
  on public.survey_questions(survey_id, section, sort_order);

alter table public.survey_questions
  drop constraint if exists survey_questions_question_type_check;

alter table public.survey_questions
  add constraint survey_questions_question_type_check
  check (question_type in ('text', 'single', 'multiple', 'appreciation', 'checklist', 'rating', 'number'));

create or replace function public.score_survey_answer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  question_record record;
  selected_answers jsonb;
  expected_answers jsonb;
  normalized_text text;
begin
  select question_type, max_points, correct_answers
  into question_record
  from public.survey_questions
  where id = new.question_id;

  if not found then
    raise exception 'Pregunta inexistente';
  end if;

  new.awarded_points := 0;

  if question_record.question_type = 'single' then
    normalized_text := coalesce(new.value_text, '');
    if question_record.correct_answers ? normalized_text then
      new.awarded_points := question_record.max_points;
    end if;

  elsif question_record.question_type in ('multiple', 'checklist') then
    selected_answers := coalesce(new.value_json, '[]'::jsonb);
    expected_answers := coalesce(question_record.correct_answers, '[]'::jsonb);
    if jsonb_typeof(selected_answers) = 'array'
       and selected_answers @> expected_answers
       and expected_answers @> selected_answers then
      new.awarded_points := question_record.max_points;
    end if;

  elsif question_record.question_type in ('appreciation', 'rating', 'number') then
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

revoke all on function public.score_survey_answer() from public;

revoke all on table public.survey_questions from anon, authenticated;
grant select (id, survey_id, prompt, question_type, required, sort_order, options, appreciation_min_label, appreciation_max_label, section) on public.survey_questions to anon, authenticated;

commit;
notify pgrst, 'reload schema';
