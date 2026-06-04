-- ================================================================
-- Encuestas evaluadas: puntaje automático y nota chilena 1,0–7,0
-- Exigencia: 60% equivale a nota 4,0.
-- Ejecutar después de 20260604_surveys.sql.
-- ================================================================

alter table public.survey_questions
  add column if not exists max_points numeric(8,2) not null default 1.0,
  add column if not exists correct_answers jsonb not null default '[]'::jsonb;

alter table public.survey_answers
  add column if not exists awarded_points numeric(8,2) not null default 0.0;

alter table public.survey_responses
  add column if not exists earned_points numeric(10,2) not null default 0.0,
  add column if not exists max_points numeric(10,2) not null default 0.0,
  add column if not exists achievement_percent numeric(6,2) not null default 0.0,
  add column if not exists grade numeric(3,1) not null default 1.0;

alter table public.survey_questions
  drop constraint if exists survey_questions_max_points_positive;
alter table public.survey_questions
  add constraint survey_questions_max_points_positive check (max_points > 0);

alter table public.survey_answers
  drop constraint if exists survey_answers_awarded_points_nonnegative;
alter table public.survey_answers
  add constraint survey_answers_awarded_points_nonnegative check (awarded_points >= 0);

create or replace function public.chilean_grade_from_percent(percent_value numeric)
returns numeric
language plpgsql
immutable
as $$
declare
  normalized numeric := greatest(0, least(coalesce(percent_value, 0), 100));
  result numeric;
begin
  if normalized <= 60 then
    result := 1.0 + (normalized / 60.0) * 3.0;
  else
    result := 4.0 + ((normalized - 60.0) / 40.0) * 3.0;
  end if;
  return round(result, 1);
end;
$$;

create or replace function public.reset_survey_response_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.earned_points := 0;
  new.max_points := 0;
  new.achievement_percent := 0;
  new.grade := 1.0;
  return new;
end;
$$;

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

  elsif question_record.question_type = 'multiple' then
    selected_answers := coalesce(new.value_json, '[]'::jsonb);
    expected_answers := coalesce(question_record.correct_answers, '[]'::jsonb);
    if jsonb_typeof(selected_answers) = 'array'
       and selected_answers @> expected_answers
       and expected_answers @> selected_answers then
      new.awarded_points := question_record.max_points;
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

create or replace function public.recalculate_survey_response(target_response_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  survey_identifier uuid;
  earned numeric := 0;
  maximum numeric := 0;
  percent numeric := 0;
begin
  select survey_id into survey_identifier
  from public.survey_responses
  where id = target_response_id;

  if survey_identifier is null then
    return;
  end if;

  select coalesce(sum(sa.awarded_points), 0)
  into earned
  from public.survey_answers sa
  where sa.response_id = target_response_id;

  select coalesce(sum(sq.max_points), 0)
  into maximum
  from public.survey_questions sq
  where sq.survey_id = survey_identifier;

  if maximum > 0 then
    percent := round((earned / maximum) * 100.0, 2);
  else
    percent := 0;
  end if;

  update public.survey_responses
  set earned_points = earned,
      max_points = maximum,
      achievement_percent = percent,
      grade = public.chilean_grade_from_percent(percent)
  where id = target_response_id;
end;
$$;

create or replace function public.refresh_survey_response_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_survey_response(coalesce(new.response_id, old.response_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reset_survey_response_score on public.survey_responses;
create trigger trg_reset_survey_response_score
before insert on public.survey_responses
for each row execute function public.reset_survey_response_score();

drop trigger if exists trg_score_survey_answer on public.survey_answers;
create trigger trg_score_survey_answer
before insert or update on public.survey_answers
for each row execute function public.score_survey_answer();

drop trigger if exists trg_refresh_survey_response_score on public.survey_answers;
create trigger trg_refresh_survey_response_score
after insert or update or delete on public.survey_answers
for each row execute function public.refresh_survey_response_score();

-- Recalcular respuestas existentes después de instalar la migración.
do $$
declare
  response_record record;
begin
  for response_record in select id from public.survey_responses loop
    perform public.recalculate_survey_response(response_record.id);
  end loop;
end;
$$;

revoke all on function public.chilean_grade_from_percent(numeric) from public;
revoke all on function public.reset_survey_response_score() from public;
revoke all on function public.score_survey_answer() from public;
revoke all on function public.recalculate_survey_response(uuid) from public;
revoke all on function public.refresh_survey_response_score() from public;

grant execute on function public.chilean_grade_from_percent(numeric) to authenticated;
