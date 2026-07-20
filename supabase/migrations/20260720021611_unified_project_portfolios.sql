-- Portafolio unificado por proyecto.
-- Vincula datos históricos y mantiene una copia completa de cada formulario
-- sin duplicar los archivos almacenados en Storage.

begin;

create schema if not exists private;

alter table public.surveys
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.survey_responses
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.self_evaluations
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists idx_surveys_project on public.surveys(project_id);
create index if not exists idx_survey_responses_project_user
  on public.survey_responses(project_id, registered_user_id, created_at desc);
create index if not exists idx_self_evaluations_project_user
  on public.self_evaluations(project_id, user_id, created_at desc);

-- Cada usuario trabajó en un solo proyecto. Se consideran tanto proyectos
-- propios como colaboraciones aceptadas para vincular el contenido anterior.
with candidate_projects as (
  select p.owner_id as user_id, p.id as project_id from public.projects p
  union
  select pc.user_id, pc.project_id
  from public.project_collaborators pc
  where pc.status = 'accepted'
), unique_projects as (
  select user_id, min(project_id::text)::uuid as project_id
  from candidate_projects
  group by user_id
  having count(distinct project_id) = 1
)
update public.self_evaluations se
set project_id = up.project_id
from unique_projects up
where se.project_id is null and up.user_id = se.user_id;

with candidate_projects as (
  select p.owner_id as user_id, p.id as project_id from public.projects p
  union
  select pc.user_id, pc.project_id
  from public.project_collaborators pc
  where pc.status = 'accepted'
), unique_projects as (
  select user_id, min(project_id::text)::uuid as project_id
  from candidate_projects
  group by user_id
  having count(distinct project_id) = 1
)
update public.survey_responses sr
set project_id = up.project_id
from unique_projects up
where sr.project_id is null
  and sr.registered_user_id = up.user_id;

-- Una encuesta queda vinculada cuando todas sus respuestas registradas apuntan
-- al mismo proyecto. Si aún no tiene respuestas, se usa el único proyecto del curso.
with response_projects as (
  select survey_id, min(project_id::text)::uuid as project_id
  from public.survey_responses
  where project_id is not null
  group by survey_id
  having count(distinct project_id) = 1
)
update public.surveys s
set project_id = rp.project_id
from response_projects rp
where s.id = rp.survey_id and s.project_id is null;

with course_projects as (
  select course_id, min(id::text)::uuid as project_id
  from public.projects
  where course_id is not null
  group by course_id
  having count(*) = 1
)
update public.surveys s
set project_id = cp.project_id
from course_projects cp
where s.project_id is null and s.course_id = cp.course_id;

update public.survey_responses sr
set project_id = s.project_id
from public.surveys s
where sr.survey_id = s.id
  and sr.project_id is null
  and s.project_id is not null;

create table if not exists public.project_portfolios (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, user_id)
);

create table if not exists public.project_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  project_portfolio_id uuid not null references public.project_portfolios(id) on delete cascade,
  source_type text not null check (source_type in (
    'project_form','evidence','followup','survey_response','self_evaluation',
    'public_page','report','steam_workspace'
  )),
  source_id uuid not null,
  title text not null,
  snapshot jsonb not null default '{}'::jsonb,
  source_created_at timestamptz,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_portfolio_id, source_type, source_id)
);

create index if not exists idx_project_portfolios_user
  on public.project_portfolios(user_id, updated_at desc);
create index if not exists idx_project_portfolios_project
  on public.project_portfolios(project_id);
create index if not exists idx_project_portfolio_items_portfolio
  on public.project_portfolio_items(project_portfolio_id, source_type, source_created_at);

alter table public.project_portfolios enable row level security;
alter table public.project_portfolio_items enable row level security;

drop policy if exists project_portfolios_read_authorized on public.project_portfolios;
create policy project_portfolios_read_authorized
on public.project_portfolios for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid())
      and pr.role in ('admin','administrador','docente','coordinador','utp')
  )
);

drop policy if exists project_portfolio_items_read_authorized on public.project_portfolio_items;
create policy project_portfolio_items_read_authorized
on public.project_portfolio_items for select to authenticated
using (
  exists (
    select 1 from public.project_portfolios pp
    where pp.id = project_portfolio_id
      and (
        pp.user_id = (select auth.uid())
        or exists (
          select 1 from public.profiles pr
          where pr.id = (select auth.uid())
            and pr.role in ('admin','administrador','docente','coordinador','utp')
        )
      )
  )
);

revoke all on table public.project_portfolios from anon, authenticated;
revoke all on table public.project_portfolio_items from anon, authenticated;
grant select on table public.project_portfolios to authenticated;
grant select on table public.project_portfolio_items to authenticated;

create or replace function private.ensure_project_portfolio(
  target_project_id uuid,
  target_user_id uuid,
  target_role text default 'student'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  linked_portfolio_id uuid;
  project_year integer;
begin
  if target_project_id is null or target_user_id is null then return null; end if;

  select extract(year from coalesce(p.created_at, now()))::integer
  into project_year
  from public.projects p where p.id = target_project_id;

  select po.id into linked_portfolio_id
  from public.portfolios po
  where po.user_id = target_user_id and po.year = project_year
  order by po.created_at desc limit 1;

  insert into public.project_portfolios(portfolio_id, project_id, user_id, member_role)
  values (linked_portfolio_id, target_project_id, target_user_id, coalesce(target_role, 'student'))
  on conflict (project_id, user_id) do update
    set portfolio_id = coalesce(excluded.portfolio_id, public.project_portfolios.portfolio_id),
        member_role = excluded.member_role,
        updated_at = now()
  returning id into result_id;
  return result_id;
end;
$$;

create or replace function private.upsert_project_portfolio_item(
  target_project_id uuid,
  target_user_id uuid,
  target_source_type text,
  target_source_id uuid,
  target_title text,
  target_snapshot jsonb,
  target_created_at timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_portfolio_id uuid;
begin
  target_portfolio_id := private.ensure_project_portfolio(target_project_id, target_user_id, 'student');
  if target_portfolio_id is null then return; end if;
  insert into public.project_portfolio_items(
    project_portfolio_id, source_type, source_id, title, snapshot, source_created_at
  ) values (
    target_portfolio_id, target_source_type, target_source_id,
    coalesce(nullif(target_title, ''), 'Registro de portafolio'),
    coalesce(target_snapshot, '{}'::jsonb), target_created_at
  )
  on conflict (project_portfolio_id, source_type, source_id) do update
    set title = excluded.title,
        snapshot = excluded.snapshot,
        source_created_at = excluded.source_created_at,
        captured_at = now(),
        updated_at = now();
end;
$$;

create or replace function private.sync_shared_project_item(
  target_project_id uuid,
  target_source_type text,
  target_source_id uuid,
  target_title text,
  target_snapshot jsonb,
  target_created_at timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare member record;
begin
  for member in select user_id from public.project_portfolios where project_id = target_project_id loop
    perform private.upsert_project_portfolio_item(
      target_project_id, member.user_id, target_source_type, target_source_id,
      target_title, target_snapshot, target_created_at
    );
  end loop;
end;
$$;

-- Crear expedientes para toda la participación ya registrada.
insert into public.project_portfolios(portfolio_id, project_id, user_id, member_role)
select po.id, members.project_id, members.user_id, members.member_role
from (
  select p.id project_id, p.owner_id user_id, 'owner'::text member_role, p.created_at from public.projects p
  union
  select pc.project_id, pc.user_id, coalesce(pc.role, 'collaborator'), p.created_at
  from public.project_collaborators pc join public.projects p on p.id = pc.project_id
  where pc.status = 'accepted'
  union
  select r.project_id, rm.user_id, rm.member_role, r.created_at
  from public.project_report_members rm join public.project_reports r on r.id = rm.report_id
) members
left join public.portfolios po
  on po.user_id = members.user_id
 and po.year = extract(year from coalesce(members.created_at, now()))::integer
on conflict (project_id, user_id) do update
set portfolio_id = coalesce(excluded.portfolio_id, public.project_portfolios.portfolio_id),
    member_role = excluded.member_role,
    updated_at = now();

-- Copia completa del formulario del proyecto para cada integrante.
insert into public.project_portfolio_items(
  project_portfolio_id, source_type, source_id, title, snapshot, source_created_at
)
select pp.id, 'project_form', p.id, p.title, to_jsonb(p), p.created_at
from public.project_portfolios pp join public.projects p on p.id = pp.project_id
on conflict (project_portfolio_id, source_type, source_id) do update
set title = excluded.title, snapshot = excluded.snapshot, updated_at = now();

-- Evidencias: contenido compartido del proyecto, conservando el autor en el JSON.
insert into public.project_portfolio_items(
  project_portfolio_id, source_type, source_id, title, snapshot, source_created_at
)
select pp.id, 'evidence', e.id, e.title, to_jsonb(e), e.created_at
from public.project_portfolios pp join public.evidences e on e.project_id = pp.project_id
on conflict (project_portfolio_id, source_type, source_id) do update
set title = excluded.title, snapshot = excluded.snapshot, updated_at = now();

-- Contenido individual vinculado automáticamente al único proyecto del usuario.
insert into public.project_portfolio_items(
  project_portfolio_id, source_type, source_id, title, snapshot, source_created_at
)
select pp.id, 'self_evaluation', se.id, 'Autoevaluación', to_jsonb(se), se.created_at
from public.self_evaluations se
join public.project_portfolios pp on pp.project_id = se.project_id and pp.user_id = se.user_id
where se.project_id is not null
on conflict (project_portfolio_id, source_type, source_id) do update
set snapshot = excluded.snapshot, updated_at = now();

insert into public.project_portfolio_items(
  project_portfolio_id, source_type, source_id, title, snapshot, source_created_at
)
select pp.id, 'survey_response', sr.id, s.title,
  jsonb_build_object('survey', to_jsonb(s), 'response', to_jsonb(sr), 'questions', coalesce((
    select jsonb_agg(to_jsonb(sq) order by sq.sort_order) from public.survey_questions sq where sq.survey_id = s.id
  ), '[]'::jsonb), 'answers', coalesce((
    select jsonb_agg(to_jsonb(sa) order by sa.created_at) from public.survey_answers sa where sa.response_id = sr.id
  ), '[]'::jsonb)), sr.created_at
from public.survey_responses sr
join public.surveys s on s.id = sr.survey_id
join public.project_portfolios pp on pp.project_id = sr.project_id and pp.user_id = sr.registered_user_id
where sr.project_id is not null and sr.registered_user_id is not null
on conflict (project_portfolio_id, source_type, source_id) do update
set title = excluded.title, snapshot = excluded.snapshot, updated_at = now();

-- Módulos compartidos ya existentes.
insert into public.project_portfolio_items(project_portfolio_id, source_type, source_id, title, snapshot, source_created_at)
select pp.id, 'public_page', pg.id, pg.title,
  jsonb_build_object('page', to_jsonb(pg), 'blocks', coalesce((select jsonb_agg(to_jsonb(b) order by b.sort_order) from public.project_public_blocks b where b.page_id = pg.id), '[]'::jsonb), 'assets', coalesce((select jsonb_agg(to_jsonb(a) order by a.sort_order) from public.project_public_assets a where a.page_id = pg.id), '[]'::jsonb)), pg.created_at
from public.project_public_pages pg join public.project_portfolios pp on pp.project_id = pg.project_id
where pg.project_id is not null
on conflict (project_portfolio_id, source_type, source_id) do update set title = excluded.title, snapshot = excluded.snapshot, updated_at = now();

insert into public.project_portfolio_items(project_portfolio_id, source_type, source_id, title, snapshot, source_created_at)
select pp.id, 'report', r.id, r.title,
  jsonb_build_object('report', to_jsonb(r), 'members', coalesce((select jsonb_agg(to_jsonb(m)) from public.project_report_members m where m.report_id = r.id), '[]'::jsonb), 'sections', coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order) from public.project_report_sections s where s.report_id = r.id), '[]'::jsonb), 'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.project_report_comments c where c.report_id = r.id), '[]'::jsonb), 'evaluation', (select to_jsonb(ev) from public.project_report_evaluations ev where ev.report_id = r.id limit 1)), r.created_at
from public.project_reports r join public.project_portfolios pp on pp.project_id = r.project_id
on conflict (project_portfolio_id, source_type, source_id) do update set title = excluded.title, snapshot = excluded.snapshot, updated_at = now();

insert into public.project_portfolio_items(project_portfolio_id, source_type, source_id, title, snapshot, source_created_at)
select pp.id, 'steam_workspace', w.id, 'Ruta STEAM',
  jsonb_build_object('workspace', to_jsonb(w), 'phases', coalesce((select jsonb_agg(to_jsonb(pe) order by pe.phase_number) from public.steam_phase_entries pe where pe.workspace_id = w.id), '[]'::jsonb), 'journal', coalesce((select jsonb_agg(to_jsonb(j) order by j.entry_date) from public.steam_journal_entries j where j.workspace_id = w.id), '[]'::jsonb), 'prototypes', coalesce((select jsonb_agg(to_jsonb(v) order by v.version_number) from public.steam_prototype_versions v where v.workspace_id = w.id), '[]'::jsonb), 'tests', coalesce((select jsonb_agg(to_jsonb(t) order by t.version_number) from public.steam_project_tests t where t.workspace_id = w.id), '[]'::jsonb)), w.created_at
from public.steam_project_workspaces w join public.project_portfolios pp on pp.project_id = w.project_id
on conflict (project_portfolio_id, source_type, source_id) do update set snapshot = excluded.snapshot, updated_at = now();

-- Seguimientos solo para los estudiantes participantes.
insert into public.project_portfolio_items(project_portfolio_id, source_type, source_id, title, snapshot, source_created_at)
select pp.id, 'followup', f.id, concat('Seguimiento ', coalesce(f.followup_date::text, '')),
  jsonb_build_object('followup', to_jsonb(f), 'participants', coalesce((select jsonb_agg(to_jsonb(fp)) from public.followup_participants fp where fp.followup_id = f.id), '[]'::jsonb), 'items', coalesce((select jsonb_agg(to_jsonb(fi) order by fi.sort_order) from public.followup_items fi where fi.followup_id = f.id), '[]'::jsonb), 'photos', coalesce((select jsonb_agg(to_jsonb(ph) order by ph.created_at) from public.followup_photos ph where ph.followup_id = f.id), '[]'::jsonb)), f.created_at
from public.project_followups f
join public.followup_participants participant on participant.followup_id = f.id
join public.project_portfolios pp on pp.project_id = f.project_id and pp.user_id = participant.user_id
on conflict (project_portfolio_id, source_type, source_id) do update set snapshot = excluded.snapshot, updated_at = now();

-- Sincronización automática de las filas principales. Las tablas fuente siguen
-- siendo editables; el portafolio recibe el formulario completo con to_jsonb.
create or replace function private.sync_project_form_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.ensure_project_portfolio(new.id, new.owner_id, 'owner');
  perform private.sync_shared_project_item(new.id, 'project_form', new.id, new.title, to_jsonb(new), new.created_at);
  return new;
end; $$;

create or replace function private.sync_evidence_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.ensure_project_portfolio(new.project_id, new.created_by, 'student');
  perform private.sync_shared_project_item(new.project_id, 'evidence', new.id, new.title, to_jsonb(new), new.created_at);
  return new;
end; $$;

create or replace function private.sync_self_evaluation_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.project_id is null then
    select candidate.project_id into new.project_id from (
      select min(x.project_id::text)::uuid project_id from (
        select id project_id from public.projects where owner_id = new.user_id
        union select project_id from public.project_collaborators where user_id = new.user_id and status = 'accepted'
      ) x having count(distinct x.project_id) = 1
    ) candidate;
  end if;
  if new.project_id is not null then
    perform private.upsert_project_portfolio_item(new.project_id, new.user_id, 'self_evaluation', new.id, 'Autoevaluación', to_jsonb(new), new.created_at);
  end if;
  return new;
end; $$;

create or replace function private.sync_survey_response_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare survey_row public.surveys%rowtype; full_snapshot jsonb;
begin
  select * into survey_row from public.surveys where id = new.survey_id;
  if new.project_id is null then
    new.project_id := survey_row.project_id;
  end if;
  if new.project_id is null and new.registered_user_id is not null then
    select min(x.project_id::text)::uuid into new.project_id from (
      select id project_id from public.projects where owner_id = new.registered_user_id
      union select project_id from public.project_collaborators where user_id = new.registered_user_id and status = 'accepted'
    ) x having count(distinct x.project_id) = 1;
  end if;
  if tg_op = 'INSERT' then return new; end if;
  if new.project_id is not null and new.registered_user_id is not null then
    full_snapshot := jsonb_build_object('survey', to_jsonb(survey_row), 'response', to_jsonb(new), 'questions', coalesce((select jsonb_agg(to_jsonb(q) order by q.sort_order) from public.survey_questions q where q.survey_id = new.survey_id), '[]'::jsonb), 'answers', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.survey_answers a where a.response_id = new.id), '[]'::jsonb));
    perform private.upsert_project_portfolio_item(new.project_id, new.registered_user_id, 'survey_response', new.id, survey_row.title, full_snapshot, new.created_at);
  end if;
  return new;
end; $$;

create or replace function private.sync_simple_shared_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare source_type text := tg_argv[0]; display_title text;
begin
  display_title := coalesce(to_jsonb(new)->>'title', replace(source_type, '_', ' '));
  perform private.sync_shared_project_item(new.project_id, source_type, new.id, display_title, to_jsonb(new), new.created_at);
  return new;
end; $$;

create or replace function private.refresh_survey_response(target_response_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare response_row public.survey_responses%rowtype; survey_row public.surveys%rowtype; full_snapshot jsonb;
begin
  select * into response_row from public.survey_responses where id = target_response_id;
  if response_row.id is null or response_row.project_id is null or response_row.registered_user_id is null then return; end if;
  select * into survey_row from public.surveys where id = response_row.survey_id;
  full_snapshot := jsonb_build_object(
    'survey', to_jsonb(survey_row),
    'response', to_jsonb(response_row),
    'questions', coalesce((select jsonb_agg(to_jsonb(q) order by q.sort_order) from public.survey_questions q where q.survey_id = response_row.survey_id), '[]'::jsonb),
    'answers', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.survey_answers a where a.response_id = response_row.id), '[]'::jsonb)
  );
  perform private.upsert_project_portfolio_item(response_row.project_id, response_row.registered_user_id, 'survey_response', response_row.id, survey_row.title, full_snapshot, response_row.created_at);
end; $$;

create or replace function private.refresh_survey_answer_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.refresh_survey_response(new.response_id); return new; end; $$;

create or replace function private.refresh_survey_response_after_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.refresh_survey_response(new.id); return new; end; $$;

create or replace function private.refresh_survey_question_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare response_row record;
begin
  for response_row in select id from public.survey_responses where survey_id = new.survey_id loop
    perform private.refresh_survey_response(response_row.id);
  end loop;
  return new;
end; $$;

create or replace function private.refresh_followup(target_followup_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare followup_row public.project_followups%rowtype; participant record; full_snapshot jsonb;
begin
  select * into followup_row from public.project_followups where id = target_followup_id;
  if followup_row.id is null then return; end if;
  full_snapshot := jsonb_build_object(
    'followup', to_jsonb(followup_row),
    'participants', coalesce((select jsonb_agg(to_jsonb(p)) from public.followup_participants p where p.followup_id = target_followup_id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order) from public.followup_items i where i.followup_id = target_followup_id), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(to_jsonb(ph) order by ph.created_at) from public.followup_photos ph where ph.followup_id = target_followup_id), '[]'::jsonb)
  );
  for participant in select user_id from public.followup_participants where followup_id = target_followup_id loop
    perform private.upsert_project_portfolio_item(followup_row.project_id, participant.user_id, 'followup', followup_row.id, concat('Seguimiento ', coalesce(followup_row.followup_date::text, '')), full_snapshot, followup_row.created_at);
  end loop;
end; $$;

create or replace function private.refresh_followup_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.refresh_followup(new.id); return new; end; $$;

create or replace function private.refresh_followup_child_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.refresh_followup(new.followup_id); return new; end; $$;

create or replace function private.refresh_public_page(target_page_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare page_row public.project_public_pages%rowtype; full_snapshot jsonb;
begin
  select * into page_row from public.project_public_pages where id = target_page_id;
  if page_row.id is null or page_row.project_id is null then return; end if;
  full_snapshot := jsonb_build_object(
    'page', to_jsonb(page_row),
    'blocks', coalesce((select jsonb_agg(to_jsonb(b) order by b.sort_order) from public.project_public_blocks b where b.page_id = target_page_id), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) order by a.sort_order) from public.project_public_assets a where a.page_id = target_page_id), '[]'::jsonb)
  );
  perform private.sync_shared_project_item(page_row.project_id, 'public_page', page_row.id, page_row.title, full_snapshot, page_row.created_at);
end; $$;

create or replace function private.refresh_public_page_child_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.refresh_public_page(new.page_id); return new; end; $$;

create or replace function private.refresh_public_page_parent_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.refresh_public_page(new.id); return new; end; $$;

create or replace function private.refresh_report(target_report_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare report_row public.project_reports%rowtype; full_snapshot jsonb;
begin
  select * into report_row from public.project_reports where id = target_report_id;
  if report_row.id is null then return; end if;
  full_snapshot := jsonb_build_object(
    'report', to_jsonb(report_row),
    'members', coalesce((select jsonb_agg(to_jsonb(m)) from public.project_report_members m where m.report_id = target_report_id), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order) from public.project_report_sections s where s.report_id = target_report_id), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.project_report_comments c where c.report_id = target_report_id), '[]'::jsonb),
    'evaluation', (select to_jsonb(ev) || jsonb_build_object('scores', coalesce((select jsonb_agg(to_jsonb(sc)) from public.project_report_scores sc where sc.evaluation_id = ev.id), '[]'::jsonb)) from public.project_report_evaluations ev where ev.report_id = target_report_id limit 1)
  );
  perform private.sync_shared_project_item(report_row.project_id, 'report', report_row.id, report_row.title, full_snapshot, report_row.created_at);
end; $$;

create or replace function private.refresh_report_child_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.refresh_report(new.report_id); return new; end; $$;

create or replace function private.refresh_report_score_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target_report_id uuid;
begin select report_id into target_report_id from public.project_report_evaluations where id = new.evaluation_id; perform private.refresh_report(target_report_id); return new; end; $$;

create or replace function private.refresh_report_parent_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.refresh_report(new.id); return new; end; $$;

create or replace function private.refresh_steam_workspace(target_workspace_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare workspace_row public.steam_project_workspaces%rowtype; full_snapshot jsonb;
begin
  select * into workspace_row from public.steam_project_workspaces where id = target_workspace_id;
  if workspace_row.id is null then return; end if;
  full_snapshot := jsonb_build_object(
    'workspace', to_jsonb(workspace_row),
    'phases', coalesce((select jsonb_agg(to_jsonb(p) order by p.phase_number) from public.steam_phase_entries p where p.workspace_id = target_workspace_id), '[]'::jsonb),
    'journal', coalesce((select jsonb_agg(to_jsonb(j) order by j.entry_date) from public.steam_journal_entries j where j.workspace_id = target_workspace_id), '[]'::jsonb),
    'prototypes', coalesce((select jsonb_agg(to_jsonb(v) order by v.version_number) from public.steam_prototype_versions v where v.workspace_id = target_workspace_id), '[]'::jsonb),
    'tests', coalesce((select jsonb_agg(to_jsonb(t) order by t.version_number) from public.steam_project_tests t where t.workspace_id = target_workspace_id), '[]'::jsonb)
  );
  perform private.sync_shared_project_item(workspace_row.project_id, 'steam_workspace', workspace_row.id, 'Ruta STEAM', full_snapshot, workspace_row.created_at);
end; $$;

create or replace function private.refresh_steam_parent_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.refresh_steam_workspace(new.id); return new; end; $$;

create or replace function private.refresh_steam_child_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.refresh_steam_workspace(new.workspace_id); return new; end; $$;

create or replace function private.ensure_collaborator_portfolio_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'accepted' then perform private.ensure_project_portfolio(new.project_id, new.user_id, coalesce(new.role, 'collaborator')); end if;
  return new;
end; $$;

create or replace function private.ensure_report_member_portfolio_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target_project_id uuid;
begin
  select project_id into target_project_id from public.project_reports where id = new.report_id;
  perform private.ensure_project_portfolio(target_project_id, new.user_id, new.member_role);
  perform private.refresh_report(new.report_id);
  return new;
end; $$;

drop trigger if exists portfolio_sync_project on public.projects;
create trigger portfolio_sync_project after insert or update on public.projects
for each row execute function private.sync_project_form_trigger();
drop trigger if exists portfolio_sync_evidence on public.evidences;
create trigger portfolio_sync_evidence after insert or update on public.evidences
for each row execute function private.sync_evidence_trigger();
drop trigger if exists portfolio_sync_self_evaluation on public.self_evaluations;
create trigger portfolio_sync_self_evaluation before insert or update on public.self_evaluations
for each row execute function private.sync_self_evaluation_trigger();
drop trigger if exists portfolio_prepare_survey_response on public.survey_responses;
create trigger portfolio_prepare_survey_response before insert or update on public.survey_responses
for each row execute function private.sync_survey_response_trigger();
drop trigger if exists portfolio_sync_survey_response_after on public.survey_responses;
create trigger portfolio_sync_survey_response_after after insert or update on public.survey_responses
for each row execute function private.refresh_survey_response_after_trigger();
drop trigger if exists portfolio_sync_survey_answer on public.survey_answers;
create trigger portfolio_sync_survey_answer after insert or update on public.survey_answers
for each row execute function private.refresh_survey_answer_trigger();
drop trigger if exists portfolio_sync_survey_question on public.survey_questions;
create trigger portfolio_sync_survey_question after insert or update on public.survey_questions
for each row execute function private.refresh_survey_question_trigger();
drop trigger if exists portfolio_sync_followup on public.project_followups;
create trigger portfolio_sync_followup after insert or update on public.project_followups
for each row execute function private.refresh_followup_trigger();
drop trigger if exists portfolio_sync_followup_participant on public.followup_participants;
create trigger portfolio_sync_followup_participant after insert or update on public.followup_participants
for each row execute function private.refresh_followup_child_trigger();
drop trigger if exists portfolio_sync_followup_item on public.followup_items;
create trigger portfolio_sync_followup_item after insert or update on public.followup_items
for each row execute function private.refresh_followup_child_trigger();
drop trigger if exists portfolio_sync_followup_photo on public.followup_photos;
create trigger portfolio_sync_followup_photo after insert or update on public.followup_photos
for each row execute function private.refresh_followup_child_trigger();
drop trigger if exists portfolio_sync_public_page on public.project_public_pages;
create trigger portfolio_sync_public_page after insert or update on public.project_public_pages
for each row execute function private.refresh_public_page_parent_trigger();
drop trigger if exists portfolio_sync_public_block on public.project_public_blocks;
create trigger portfolio_sync_public_block after insert or update on public.project_public_blocks
for each row execute function private.refresh_public_page_child_trigger();
drop trigger if exists portfolio_sync_public_asset on public.project_public_assets;
create trigger portfolio_sync_public_asset after insert or update on public.project_public_assets
for each row execute function private.refresh_public_page_child_trigger();
drop trigger if exists portfolio_sync_report on public.project_reports;
create trigger portfolio_sync_report after insert or update on public.project_reports
for each row execute function private.refresh_report_parent_trigger();
drop trigger if exists portfolio_sync_report_member on public.project_report_members;
create trigger portfolio_sync_report_member after insert or update on public.project_report_members
for each row execute function private.ensure_report_member_portfolio_trigger();
drop trigger if exists portfolio_sync_report_section on public.project_report_sections;
create trigger portfolio_sync_report_section after insert or update on public.project_report_sections
for each row execute function private.refresh_report_child_trigger();
drop trigger if exists portfolio_sync_report_comment on public.project_report_comments;
create trigger portfolio_sync_report_comment after insert or update on public.project_report_comments
for each row execute function private.refresh_report_child_trigger();
drop trigger if exists portfolio_sync_report_evaluation on public.project_report_evaluations;
create trigger portfolio_sync_report_evaluation after insert or update on public.project_report_evaluations
for each row execute function private.refresh_report_child_trigger();
drop trigger if exists portfolio_sync_report_score on public.project_report_scores;
create trigger portfolio_sync_report_score after insert or update on public.project_report_scores
for each row execute function private.refresh_report_score_trigger();
drop trigger if exists portfolio_sync_collaborator on public.project_collaborators;
create trigger portfolio_sync_collaborator after insert or update on public.project_collaborators
for each row execute function private.ensure_collaborator_portfolio_trigger();
drop trigger if exists portfolio_sync_steam_workspace on public.steam_project_workspaces;
create trigger portfolio_sync_steam_workspace after insert or update on public.steam_project_workspaces
for each row execute function private.refresh_steam_parent_trigger();
drop trigger if exists portfolio_sync_steam_phase on public.steam_phase_entries;
create trigger portfolio_sync_steam_phase after insert or update on public.steam_phase_entries
for each row execute function private.refresh_steam_child_trigger();
drop trigger if exists portfolio_sync_steam_journal on public.steam_journal_entries;
create trigger portfolio_sync_steam_journal after insert or update on public.steam_journal_entries
for each row execute function private.refresh_steam_child_trigger();
drop trigger if exists portfolio_sync_steam_prototype on public.steam_prototype_versions;
create trigger portfolio_sync_steam_prototype after insert or update on public.steam_prototype_versions
for each row execute function private.refresh_steam_child_trigger();
drop trigger if exists portfolio_sync_steam_test on public.steam_project_tests;
create trigger portfolio_sync_steam_test after insert or update on public.steam_project_tests
for each row execute function private.refresh_steam_child_trigger();

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role;

notify pgrst, 'reload schema';
commit;
