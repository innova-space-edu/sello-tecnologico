-- ================================================================
-- Encuestas editables con secciones, listas de cotejo y escalas
-- Ejecutar despues de:
-- 1. 20260604_surveys.sql
-- 2. 20260604_surveys_scoring.sql
-- 3. 20260604_surveys_option_scores.sql
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

  elsif question_record.question_type in ('multiple', 'checklist') then
    selected_answers := coalesce(new.value_json, '[]'::jsonb);
    if jsonb_typeof(selected_answers) = 'array' then
      select coalesce(sum(greatest(0, coalesce((question_record.option_scores ->> selected.value)::numeric, 0))), 0)
      into accumulated
      from jsonb_array_elements_text(selected_answers) as selected(value);
      new.awarded_points := least(question_record.max_points, accumulated);
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

update public.survey_answers
set value_text = value_text,
    value_json = value_json,
    value_number = value_number;

revoke all on table public.survey_questions from anon, authenticated;
grant select (id, survey_id, prompt, question_type, required, sort_order, options, appreciation_min_label, appreciation_max_label, section) on public.survey_questions to anon, authenticated;

commit;
notify pgrst, 'reload schema';
