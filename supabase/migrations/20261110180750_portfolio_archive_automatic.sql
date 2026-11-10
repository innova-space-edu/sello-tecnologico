
-- Archivo histórico personal de CreaLab. Independiente de las tablas originales.
-- Los objetos multimedia se registran como referencia, no se duplican aquí.
create schema if not exists private;
create table if not exists public.portfolio_archive_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  source_table text not null,
  source_id uuid not null,
  category text not null,
  title text not null,
  summary text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  attachment_refs jsonb not null default '{}'::jsonb,
  source_created_at timestamptz,
  captured_at timestamptz not null default now(),
  source_deleted boolean not null default false,
  source_deleted_at timestamptz,
  capture_count integer not null default 1,
  unique(owner_id,source_table,source_id)
);
create index if not exists portfolio_archive_owner_time_idx
  on public.portfolio_archive_items(owner_id,source_created_at desc,id desc);
create index if not exists portfolio_archive_owner_category_idx
  on public.portfolio_archive_items(owner_id,category,source_created_at desc);
alter table public.portfolio_archive_items enable row level security;
revoke all on public.portfolio_archive_items from public,anon,authenticated;
grant select on public.portfolio_archive_items to authenticated;
drop policy if exists portfolio_archive_owner_read on public.portfolio_archive_items;
create policy portfolio_archive_owner_read on public.portfolio_archive_items
for select to authenticated using (owner_id = (select auth.uid()));
-- El archivo no permite borrado ni edición desde el navegador.

create or replace function private.portfolio_archive_snapshot(
  p_source text, p_data jsonb, p_event text default 'update'
) returns void language plpgsql security definer set search_path=pg_catalog,public,private
as $body$
declare
  v_owner uuid;
  v_project uuid;
  v_id uuid;
  v_fields text[];
  v_payload jsonb;
  v_category text;
  v_title text;
  v_summary text;
  v_refs jsonb;
  v_created timestamptz;
begin
  if p_source not in ('projects','evidences','project_reports','project_report_sections','project_public_pages','project_public_blocks','project_public_assets','creative_space_works','project_followups','followup_items','followup_photos','self_evaluations','surveys','survey_responses','online_surveys','portfolio_sections','documents','steam_project_workspaces','steam_phase_entries','steam_journal_entries','steam_prototype_versions','steam_project_tests','community_stories','community_story_items','report_downloads') then return; end if;
  if p_data is null or p_data->>'id' is null then return; end if;
  v_id := (p_data->>'id')::uuid;
  v_category := case p_source
    when 'projects' then 'proyectos'
    when 'evidences' then 'evidencias'
    when 'project_reports' then 'informes'
    when 'project_report_sections' then 'informes'
    when 'project_public_pages' then 'paginas'
    when 'project_public_blocks' then 'paginas'
    when 'project_public_assets' then 'paginas'
    when 'creative_space_works' then 'espacio_creativo'
    when 'project_followups' then 'seguimientos'
    when 'followup_items' then 'seguimientos'
    when 'followup_photos' then 'seguimientos'
    when 'self_evaluations' then 'autoevaluaciones'
    when 'surveys' then 'encuestas'
    when 'survey_responses' then 'encuestas'
    when 'online_surveys' then 'encuestas'
    when 'portfolio_sections' then 'portafolio'
    when 'documents' then 'documentos'
    when 'steam_project_workspaces' then 'steam'
    when 'steam_phase_entries' then 'steam'
    when 'steam_journal_entries' then 'steam'
    when 'steam_prototype_versions' then 'steam'
    when 'steam_project_tests' then 'steam'
    when 'community_stories' then 'historias'
    when 'community_story_items' then 'historias'
    when 'report_downloads' then 'reportes'
    else 'otros' end;
  v_fields := case p_source
    when 'projects' then array['id','title','description','type','status','tipo_proyecto','metodologia','objectives','objetivos_aprendizaje','pregunta_guia','hipotesis','objetivo_general','objetivos_especificos','etapas_metodologia','solucion_propuesta','resultados_esperados','aprendizajes_logrados','dificultades','mejoras','impacto_comunidad','herramientas_tecnologicas','steam_ciencia','steam_tecnologia','steam_ingenieria','steam_arte','steam_matematica','boceto_url','created_at','updated_at']::text[]
    when 'evidences' then array['id','title','description','type','file_url','file_name','file_type','file_size','drive_url','tags','reflexion_aprendizaje','dificultad','como_resolvi','herramienta_usada','uso_ia','evidencia_tipo','created_at']::text[]
    when 'project_reports' then array['id','title','status','project_id','submitted_at','created_at','updated_at']::text[]
    when 'project_report_sections' then array['id','report_id','section_type','title','content','sort_order','created_at','updated_at']::text[]
    when 'project_public_pages' then array['id','project_id','title','slug','description','status','published_at','is_public','hero_badge','call_to_action_label','call_to_action_url','created_at','updated_at']::text[]
    when 'project_public_blocks' then array['id','page_id','type','title','content','settings','sort_order','created_at','updated_at']::text[]
    when 'project_public_assets' then array['id','page_id','title','description','file_name','file_type','mime_type','file_size','storage_bucket','storage_path','created_at']::text[]
    when 'creative_space_works' then array['id','title','description','author_name','media_type','file_name','file_size','storage_path','tags','status','created_at','updated_at']::text[]
    when 'project_followups' then array['id','project_id','followup_date','subject','ticket','feedback','overall_status','score','created_at','updated_at']::text[]
    when 'followup_items' then array['id','followup_id','criterion','result','score','comment','sort_order','created_at']::text[]
    when 'followup_photos' then array['id','followup_id','file_name','mime_type','file_size','storage_path','created_at']::text[]
    when 'self_evaluations' then array['id','project_name','intervention_place','answers','confirmed','status','created_at','updated_at']::text[]
    when 'surveys' then array['id','title','description','slug','is_active','created_at','updated_at']::text[]
    when 'survey_responses' then array['id','survey_id','earned_points','max_points','achievement_percent','grade','feedback','results_visible','created_at']::text[]
    when 'online_surveys' then array['id','title','description','slug','questions','status','created_at','updated_at']::text[]
    when 'portfolio_sections' then array['id','title','type','content','options','selected_option','file_url','file_name','file_type','order_index','created_at']::text[]
    when 'documents' then array['id','title','type','status','is_shared','project_id','created_at','updated_at']::text[]
    when 'steam_project_workspaces' then array['id','project_id','template_slug','route_type','current_phase','progress_percent','created_at','updated_at']::text[]
    when 'steam_phase_entries' then array['id','workspace_id','phase_number','phase_key','status','content','student_reflection','submitted_at','created_at','updated_at']::text[]
    when 'steam_journal_entries' then array['id','workspace_id','phase_number','work_done','problem_found','next_step','entry_date','created_at','updated_at']::text[]
    when 'steam_prototype_versions' then array['id','workspace_id','title','summary','problems','planned_changes','applied_feedback','result_summary','version_number','created_at','updated_at']::text[]
    when 'steam_project_tests' then array['id','workspace_id','criterion','expected_result','obtained_result','unit','passed','observation','version_number','created_at','updated_at']::text[]
    when 'community_stories' then array['id','title','caption','visibility_status','review_status','created_at','updated_at']::text[]
    when 'community_story_items' then array['id','story_id','media_type','storage_bucket','storage_path','file_name','mime_type','file_size','created_at']::text[]
    when 'report_downloads' then array['id','report_type','summary','created_at']::text[]
    else array['id','title','created_at']::text[] end;
  select coalesce(jsonb_object_agg(k.key, p_data->k.key),'{}'::jsonb)
    into v_payload from unnest(v_fields) as k(key) where p_data ? k.key;
  -- Restringir campos personales/privados y garantizar que solo se archiva
  -- el contenido explícitamente autorizado por la lista blanca anterior.
  v_title := left(coalesce(nullif(p_data->>'title',''),
    nullif(p_data->>'subject',''),nullif(p_data->>'file_name',''),
    nullif(p_data->>'criterion',''),nullif(p_data->>'project_name',''),
    case p_source when 'portfolio_sections' then 'Sección personal'
      when 'survey_responses' then 'Encuesta respondida'
      when 'project_report_sections' then 'Contenido del informe'
      when 'project_public_blocks' then 'Bloque de página'
      when 'community_story_items' then 'Recurso de historia'
      else initcap(replace(p_source,'_',' ')) end),180);
  v_summary := left(coalesce(nullif(p_data->>'description',''),
    nullif(p_data->>'summary',''),nullif(p_data->>'caption',''),
    nullif(p_data->>'student_reflection',''),nullif(p_data->>'feedback',''),
    nullif(p_data->>'content',''),''),400);
  v_refs := '{}'::jsonb;
  if p_data ? 'file_url' then v_refs := v_refs || jsonb_build_object('file_url',p_data->>'file_url'); end if;
  if p_data ? 'drive_url' then v_refs := v_refs || jsonb_build_object('drive_url',p_data->>'drive_url'); end if;
  if p_data ? 'storage_path' then v_refs := v_refs || jsonb_build_object('storage_path',p_data->>'storage_path'); end if;
  if p_data ? 'storage_bucket' then v_refs := v_refs || jsonb_build_object('storage_bucket',p_data->>'storage_bucket'); end if;
  if p_data ? 'file_name' then v_refs := v_refs || jsonb_build_object('file_name',p_data->>'file_name'); end if;
  v_created := coalesce(nullif(p_data->>'created_at','')::timestamptz, now());

  -- Cada persona conserva lo que creó. Para proyectos se incluyen
  -- colaboraciones aceptadas; para seguimiento, participantes inscritos.
  for v_owner in
    select distinct candidate.owner_id from (
      select case p_source
        when 'projects' then nullif(p_data->>'owner_id','')::uuid
      when 'evidences' then nullif(p_data->>'created_by','')::uuid
      when 'project_reports' then nullif(p_data->>'created_by','')::uuid
      when 'project_report_sections' then nullif(p_data->>'created_by','')::uuid
      when 'project_public_pages' then nullif(p_data->>'created_by','')::uuid
      when 'project_public_assets' then nullif(p_data->>'uploaded_by','')::uuid
      when 'creative_space_works' then nullif(p_data->>'uploader_id','')::uuid
      when 'followup_photos' then nullif(p_data->>'uploaded_by','')::uuid
      when 'self_evaluations' then nullif(p_data->>'user_id','')::uuid
      when 'surveys' then nullif(p_data->>'creator_id','')::uuid
      when 'survey_responses' then nullif(p_data->>'registered_user_id','')::uuid
      when 'online_surveys' then nullif(p_data->>'creator_id','')::uuid
      when 'documents' then nullif(p_data->>'created_by','')::uuid
      when 'steam_project_workspaces' then nullif(p_data->>'created_by','')::uuid
      when 'steam_journal_entries' then nullif(p_data->>'author_id','')::uuid
      when 'steam_prototype_versions' then nullif(p_data->>'created_by','')::uuid
      when 'steam_project_tests' then nullif(p_data->>'created_by','')::uuid
      when 'community_stories' then nullif(p_data->>'author_id','')::uuid
      when 'report_downloads' then nullif(p_data->>'user_id','')::uuid
        when 'portfolio_sections' then
          (select user_id from public.portfolios where id=(p_data->>'portfolio_id')::uuid)
        when 'project_public_blocks' then
          (select created_by from public.project_public_pages where id=(p_data->>'page_id')::uuid)
        when 'community_story_items' then
          (select author_id from public.community_stories where id=(p_data->>'story_id')::uuid)
        when 'steam_phase_entries' then
          (select p.owner_id from public.projects p join public.steam_project_workspaces w on w.project_id=p.id where w.id=(p_data->>'workspace_id')::uuid)
        when 'followup_items' then
          (select fp.user_id from public.followup_participants fp where fp.followup_id=(p_data->>'followup_id')::uuid order by fp.created_at limit 1)
        when 'project_followups' then
          (select fp.user_id from public.followup_participants fp where fp.followup_id=v_id order by fp.created_at limit 1)
        else null::uuid end as owner_id
      union all
      select c.user_id from public.project_collaborators c
      where p_source = 'projects' and c.project_id=v_id and c.status='accepted'
      union all
      select fp.user_id from public.followup_participants fp
      where (p_source='project_followups' and fp.followup_id=v_id)
        or (p_source='followup_items' and fp.followup_id=(p_data->>'followup_id')::uuid)
      union all
      select p.owner_id from public.projects p
      where p_source='steam_project_workspaces' and p.id=(p_data->>'project_id')::uuid
    ) candidate
    join public.profiles prof on prof.id=candidate.owner_id and prof.role='estudiante'
  loop
    insert into public.portfolio_archive_items(
      owner_id,source_table,source_id,category,title,summary,snapshot,attachment_refs,
      source_created_at,captured_at,source_deleted,source_deleted_at)
    values (
      v_owner,p_source,v_id,v_category,v_title,v_summary,v_payload,v_refs,v_created,now(),
      p_event='delete',case when p_event='delete' then now() else null end
    )
    on conflict(owner_id,source_table,source_id) do update set
      category=excluded.category,title=excluded.title,summary=excluded.summary,
      snapshot=excluded.snapshot,attachment_refs=excluded.attachment_refs,
      captured_at=now(),source_created_at=excluded.source_created_at,
      source_deleted=(p_event='delete'),
      source_deleted_at=case when p_event='delete' then now()
        else public.portfolio_archive_items.source_deleted_at end,
      capture_count=public.portfolio_archive_items.capture_count+1;
  end loop;
end;
$body$;

create or replace function private.portfolio_archive_trigger() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $body$
begin
  if TG_OP='DELETE' then
    perform private.portfolio_archive_snapshot(TG_TABLE_NAME,to_jsonb(old),'delete');
    return old;
  end if;
  if TG_OP='UPDATE' then
    if to_jsonb(new) = to_jsonb(old) then return new; end if;
    -- Evitar grandes escrituras redundantes por autoguardado continuo.
    if TG_TABLE_NAME='projects' and exists (
      select 1 from public.portfolio_archive_items p
      where p.source_table=TG_TABLE_NAME and p.source_id=new.id
        and p.captured_at > now() - interval '30 seconds'
    ) then return new; end if;
  end if;
  perform private.portfolio_archive_snapshot(TG_TABLE_NAME,to_jsonb(new),lower(TG_OP));
  return new;
end;
$body$;

drop trigger if exists archive_capture_projects on public.projects;
create trigger archive_capture_projects before insert or update or delete on public.projects
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_evidences on public.evidences;
create trigger archive_capture_evidences before insert or update or delete on public.evidences
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_project_reports on public.project_reports;
create trigger archive_capture_project_reports before insert or update or delete on public.project_reports
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_project_report_sections on public.project_report_sections;
create trigger archive_capture_project_report_sections before insert or update or delete on public.project_report_sections
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_project_public_pages on public.project_public_pages;
create trigger archive_capture_project_public_pages before insert or update or delete on public.project_public_pages
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_project_public_blocks on public.project_public_blocks;
create trigger archive_capture_project_public_blocks before insert or update or delete on public.project_public_blocks
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_project_public_assets on public.project_public_assets;
create trigger archive_capture_project_public_assets before insert or update or delete on public.project_public_assets
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_creative_space_works on public.creative_space_works;
create trigger archive_capture_creative_space_works before insert or update or delete on public.creative_space_works
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_project_followups on public.project_followups;
create trigger archive_capture_project_followups before insert or update or delete on public.project_followups
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_followup_items on public.followup_items;
create trigger archive_capture_followup_items before insert or update or delete on public.followup_items
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_followup_photos on public.followup_photos;
create trigger archive_capture_followup_photos before insert or update or delete on public.followup_photos
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_self_evaluations on public.self_evaluations;
create trigger archive_capture_self_evaluations before insert or update or delete on public.self_evaluations
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_surveys on public.surveys;
create trigger archive_capture_surveys before insert or update or delete on public.surveys
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_survey_responses on public.survey_responses;
create trigger archive_capture_survey_responses before insert or update or delete on public.survey_responses
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_online_surveys on public.online_surveys;
create trigger archive_capture_online_surveys before insert or update or delete on public.online_surveys
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_portfolio_sections on public.portfolio_sections;
create trigger archive_capture_portfolio_sections before insert or update or delete on public.portfolio_sections
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_documents on public.documents;
create trigger archive_capture_documents before insert or update or delete on public.documents
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_steam_project_workspaces on public.steam_project_workspaces;
create trigger archive_capture_steam_project_workspaces before insert or update or delete on public.steam_project_workspaces
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_steam_phase_entries on public.steam_phase_entries;
create trigger archive_capture_steam_phase_entries before insert or update or delete on public.steam_phase_entries
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_steam_journal_entries on public.steam_journal_entries;
create trigger archive_capture_steam_journal_entries before insert or update or delete on public.steam_journal_entries
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_steam_prototype_versions on public.steam_prototype_versions;
create trigger archive_capture_steam_prototype_versions before insert or update or delete on public.steam_prototype_versions
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_steam_project_tests on public.steam_project_tests;
create trigger archive_capture_steam_project_tests before insert or update or delete on public.steam_project_tests
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_community_stories on public.community_stories;
create trigger archive_capture_community_stories before insert or update or delete on public.community_stories
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_community_story_items on public.community_story_items;
create trigger archive_capture_community_story_items before insert or update or delete on public.community_story_items
for each row execute function private.portfolio_archive_trigger();
drop trigger if exists archive_capture_report_downloads on public.report_downloads;
create trigger archive_capture_report_downloads before insert or update or delete on public.report_downloads
for each row execute function private.portfolio_archive_trigger();

create or replace function private.portfolio_archive_new_participant() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $body$
declare f public.project_followups%rowtype;
begin
  if new.user_id is not null then
    select * into f from public.project_followups where id=new.followup_id;
    if found then perform private.portfolio_archive_snapshot('project_followups',to_jsonb(f),'update'); end if;
  end if;
  return new;
end;
$body$;
drop trigger if exists archive_followup_participant on public.followup_participants;
create trigger archive_followup_participant after insert or update on public.followup_participants
for each row execute function private.portfolio_archive_new_participant();

create or replace function private.portfolio_archive_new_collaborator() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $body$
declare p public.projects%rowtype;
begin
  if new.status='accepted' then
    select * into p from public.projects where id=new.project_id;
    if found then perform private.portfolio_archive_snapshot('projects',to_jsonb(p),'update'); end if;
  end if;
  return new;
end;
$body$;
drop trigger if exists archive_project_collaborator on public.project_collaborators;
create trigger archive_project_collaborator after insert or update on public.project_collaborators
for each row execute function private.portfolio_archive_new_collaborator();

revoke all on function private.portfolio_archive_snapshot(text,jsonb,text) from public,anon,authenticated;
revoke all on function private.portfolio_archive_trigger() from public,anon,authenticated;
revoke all on function private.portfolio_archive_new_participant() from public,anon,authenticated;
revoke all on function private.portfolio_archive_new_collaborator() from public,anon,authenticated;

-- Capturar lo que aún existe, sin crear registros vacíos ni borrar datos previos.
-- La captura de datos heredados se hace por lotes, sin depender de la navegación.
do $body$
declare t text; r record; n integer;
begin
  foreach t in array array['projects','evidences','project_reports','project_report_sections','project_public_pages','project_public_blocks','project_public_assets','creative_space_works','project_followups','followup_items','followup_photos','self_evaluations','surveys','survey_responses','online_surveys','portfolio_sections','documents','steam_project_workspaces','steam_phase_entries','steam_journal_entries','steam_prototype_versions','steam_project_tests','community_stories','community_story_items','report_downloads']::text[]
  loop
    for r in execute format('select to_jsonb(x) as payload from public.%I x order by created_at desc nulls last limit 1000',t)
    loop
      perform private.portfolio_archive_snapshot(t,r.payload,'backfill');
    end loop;
  end loop;
end;
$body$;
notify pgrst,'reload schema';
