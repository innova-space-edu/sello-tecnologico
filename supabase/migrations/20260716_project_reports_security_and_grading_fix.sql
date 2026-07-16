-- Ajustes finales de seguridad, colaboración y cálculo de nota para informes.
create schema if not exists private;

create or replace function private.is_project_report_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','docente','coordinador','utp')
  );
$$;

create or replace function private.can_read_project_report(target_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select private.is_project_report_staff()
    or exists (
      select 1 from public.project_reports r
      where r.id = target_report_id and r.created_by = auth.uid()
    )
    or exists (
      select 1 from public.project_report_members m
      where m.report_id = target_report_id and m.user_id = auth.uid()
    );
$$;

create or replace function private.can_edit_project_report(target_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1 from public.project_reports r
    where r.id = target_report_id
      and r.status in ('draft','changes_requested')
      and (
        r.created_by = auth.uid()
        or exists (
          select 1 from public.project_report_members m
          where m.report_id = r.id and m.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function private.is_project_report_leader(target_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1 from public.project_reports r
    where r.id = target_report_id and r.created_by = auth.uid()
  );
$$;

revoke all on function private.is_project_report_staff() from public, anon, authenticated;
revoke all on function private.can_read_project_report(uuid) from public, anon, authenticated;
revoke all on function private.can_edit_project_report(uuid) from public, anon, authenticated;
revoke all on function private.is_project_report_leader(uuid) from public, anon, authenticated;

drop policy if exists reports_read_visible on public.project_reports;
drop policy if exists reports_create_owner on public.project_reports;
drop policy if exists reports_update_team_or_staff on public.project_reports;
drop policy if exists report_members_read on public.project_report_members;
drop policy if exists report_members_manage_leader on public.project_report_members;
drop policy if exists report_members_delete_leader on public.project_report_members;
drop policy if exists report_sections_read on public.project_report_sections;
drop policy if exists report_sections_write on public.project_report_sections;
drop policy if exists report_comments_read on public.project_report_comments;
drop policy if exists report_comments_insert on public.project_report_comments;
drop policy if exists report_comments_update on public.project_report_comments;
drop policy if exists rubrics_read on public.project_report_rubrics;
drop policy if exists rubrics_staff_write on public.project_report_rubrics;
drop policy if exists criteria_read on public.project_report_rubric_criteria;
drop policy if exists criteria_staff_write on public.project_report_rubric_criteria;
drop policy if exists evaluations_read on public.project_report_evaluations;
drop policy if exists evaluations_staff_write on public.project_report_evaluations;
drop policy if exists scores_read on public.project_report_scores;
drop policy if exists scores_staff_write on public.project_report_scores;

create policy reports_read_visible on public.project_reports
for select to authenticated
using (private.can_read_project_report(id));

create policy reports_create_owner on public.project_reports
for insert to authenticated
with check (created_by = auth.uid());

create policy reports_update_team_or_staff on public.project_reports
for update to authenticated
using (private.can_edit_project_report(id) or private.is_project_report_staff())
with check (private.can_read_project_report(id));

create policy report_members_read on public.project_report_members
for select to authenticated
using (private.can_read_project_report(report_id));

create policy report_members_manage_leader on public.project_report_members
for insert to authenticated
with check (
  private.is_project_report_leader(report_id)
  and added_by = auth.uid()
  and member_role = 'editor'
);

create policy report_members_delete_leader on public.project_report_members
for delete to authenticated
using (
  private.is_project_report_leader(report_id)
  and member_role <> 'leader'
);

create policy report_sections_read on public.project_report_sections
for select to authenticated
using (private.can_read_project_report(report_id));

create policy report_sections_insert on public.project_report_sections
for insert to authenticated
with check (private.can_edit_project_report(report_id));

create policy report_sections_update on public.project_report_sections
for update to authenticated
using (private.can_edit_project_report(report_id))
with check (private.can_edit_project_report(report_id));

create policy report_sections_delete on public.project_report_sections
for delete to authenticated
using (private.can_edit_project_report(report_id));

create policy report_comments_read on public.project_report_comments
for select to authenticated
using (private.can_read_project_report(report_id));

create policy report_comments_insert on public.project_report_comments
for insert to authenticated
with check (
  author_id = auth.uid()
  and private.can_read_project_report(report_id)
);

create policy report_comments_update on public.project_report_comments
for update to authenticated
using (author_id = auth.uid() or private.is_project_report_staff())
with check (author_id = auth.uid() or private.is_project_report_staff());

create policy rubrics_read on public.project_report_rubrics
for select to authenticated
using (published = true or private.is_project_report_staff());

create policy rubrics_staff_write on public.project_report_rubrics
for all to authenticated
using (private.is_project_report_staff())
with check (private.is_project_report_staff() and created_by = auth.uid());

create policy criteria_read on public.project_report_rubric_criteria
for select to authenticated
using (
  exists (
    select 1 from public.project_report_rubrics r
    where r.id = rubric_id and (r.published = true or private.is_project_report_staff())
  )
);

create policy criteria_staff_write on public.project_report_rubric_criteria
for all to authenticated
using (private.is_project_report_staff())
with check (private.is_project_report_staff());

create policy evaluations_read on public.project_report_evaluations
for select to authenticated
using (private.can_read_project_report(report_id));

create policy evaluations_staff_write on public.project_report_evaluations
for all to authenticated
using (private.is_project_report_staff())
with check (private.is_project_report_staff());

create policy scores_read on public.project_report_scores
for select to authenticated
using (
  exists (
    select 1 from public.project_report_evaluations e
    where e.id = evaluation_id and private.can_read_project_report(e.report_id)
  )
);

create policy scores_staff_write on public.project_report_scores
for all to authenticated
using (private.is_project_report_staff())
with check (private.is_project_report_staff());

-- Fórmula oficial configurada para escala 1,0 a 7,0 y exigencia institucional del 60%.
-- Bajo el porcentaje de exigencia, la nota máxima visible es 3,9 para evitar que 59,x% redondee a 4,0.
create or replace function public.calculate_chilean_grade(
  earned_points numeric,
  total_points numeric,
  requirement_percent numeric default 60
)
returns numeric
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  percentage numeric;
  raw_grade numeric;
  rounded_grade numeric;
begin
  if total_points is null or total_points <= 0 then return 1.0; end if;
  percentage := greatest(0, least(100, earned_points / total_points * 100));

  if percentage < requirement_percent then
    raw_grade := 1.0 + 3.0 * percentage / requirement_percent;
    rounded_grade := round(raw_grade, 1);
    return least(3.9, greatest(1.0, rounded_grade));
  elsif percentage = requirement_percent then
    return 4.0;
  end if;

  raw_grade := 4.0 + 3.0 * (percentage - requirement_percent) / (100 - requirement_percent);
  return least(7.0, greatest(4.0, round(raw_grade, 1)));
end;
$$;

grant execute on function public.calculate_chilean_grade(numeric, numeric, numeric) to authenticated;
