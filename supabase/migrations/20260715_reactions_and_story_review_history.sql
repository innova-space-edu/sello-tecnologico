-- Reacciones múltiples en publicaciones y auditoría permanente de historias.
-- Ejecutar después de 20260715_community_stories.sql.

begin;

create extension if not exists pgcrypto;

-- Cada registro de me gusta pasa a representar una reacción elegida.
alter table public.project_public_page_likes
  add column if not exists reaction_emoji text not null default '❤️';

alter table public.project_public_page_likes
  drop constraint if exists project_public_page_likes_reaction_emoji_check;

alter table public.project_public_page_likes
  add constraint project_public_page_likes_reaction_emoji_check
  check (reaction_emoji in ('❤️','👏','🔥','🌱','💡','🚀','😂','😮'));

-- Historial de todas las decisiones sobre una historia. No se elimina al anularla.
create table if not exists public.community_story_review_history (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.community_stories(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (
    action in (
      'published',
      'approved',
      'correction_requested',
      'flagged',
      'hidden',
      'restored',
      'cancelled',
      'featured',
      'unfeatured',
      'updated'
    )
  ),
  previous_visibility_status text,
  new_visibility_status text,
  previous_review_status text,
  new_review_status text,
  previous_is_featured boolean,
  new_is_featured boolean,
  story_title text,
  story_author_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_story_review_history_story
  on public.community_story_review_history(story_id, created_at desc);

create index if not exists idx_story_review_history_action
  on public.community_story_review_history(action, created_at desc);

alter table public.community_story_review_history enable row level security;

drop policy if exists community_story_review_history_staff_read
  on public.community_story_review_history;

create policy community_story_review_history_staff_read
on public.community_story_review_history
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','docente','coordinador','utp')
  )
);

grant select on public.community_story_review_history to authenticated;

create or replace function public.log_community_story_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.community_story_review_history (
    story_id,
    actor_id,
    action,
    new_visibility_status,
    new_review_status,
    new_is_featured,
    story_title,
    story_author_id
  ) values (
    new.id,
    new.author_id,
    'published',
    new.visibility_status,
    new.review_status,
    new.is_featured,
    new.title,
    new.author_id
  );
  return new;
end;
$$;

drop trigger if exists trg_log_community_story_created
  on public.community_stories;

create trigger trg_log_community_story_created
after insert on public.community_stories
for each row execute function public.log_community_story_created();

create or replace function public.log_community_story_review_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  detected_action text := 'updated';
  acting_user uuid := auth.uid();
begin
  if old.visibility_status is not distinct from new.visibility_status
     and old.review_status is not distinct from new.review_status
     and old.is_featured is not distinct from new.is_featured then
    return new;
  end if;

  if new.visibility_status = 'deleted' and old.visibility_status is distinct from new.visibility_status then
    detected_action := 'cancelled';
  elsif new.visibility_status = 'hidden' and old.visibility_status is distinct from new.visibility_status then
    detected_action := 'hidden';
  elsif new.visibility_status = 'published' and old.visibility_status in ('hidden','deleted','expired') then
    detected_action := 'restored';
  elsif new.review_status = 'correction_requested' and old.review_status is distinct from new.review_status then
    detected_action := 'correction_requested';
  elsif new.review_status = 'flagged' and old.review_status is distinct from new.review_status then
    detected_action := 'flagged';
  elsif new.review_status = 'reviewed' and old.review_status is distinct from new.review_status then
    detected_action := 'approved';
  elsif new.is_featured = true and old.is_featured is distinct from new.is_featured then
    detected_action := 'featured';
  elsif new.is_featured = false and old.is_featured is distinct from new.is_featured then
    detected_action := 'unfeatured';
  end if;

  insert into public.community_story_review_history (
    story_id,
    actor_id,
    action,
    previous_visibility_status,
    new_visibility_status,
    previous_review_status,
    new_review_status,
    previous_is_featured,
    new_is_featured,
    story_title,
    story_author_id
  ) values (
    new.id,
    coalesce(acting_user, new.reviewed_by, new.author_id),
    detected_action,
    old.visibility_status,
    new.visibility_status,
    old.review_status,
    new.review_status,
    old.is_featured,
    new.is_featured,
    new.title,
    new.author_id
  );

  return new;
end;
$$;

drop trigger if exists trg_log_community_story_review_change
  on public.community_stories;

create trigger trg_log_community_story_review_change
after update on public.community_stories
for each row execute function public.log_community_story_review_change();

-- Crea un punto inicial para historias existentes que aún no tengan historial.
insert into public.community_story_review_history (
  story_id,
  actor_id,
  action,
  new_visibility_status,
  new_review_status,
  new_is_featured,
  story_title,
  story_author_id,
  created_at
)
select
  s.id,
  coalesce(s.reviewed_by, s.author_id),
  case
    when s.visibility_status = 'deleted' then 'cancelled'
    when s.visibility_status = 'hidden' then 'hidden'
    when s.review_status = 'correction_requested' then 'correction_requested'
    when s.review_status = 'flagged' then 'flagged'
    when s.review_status = 'reviewed' then 'approved'
    else 'published'
  end,
  s.visibility_status,
  s.review_status,
  s.is_featured,
  s.title,
  s.author_id,
  coalesce(s.reviewed_at, s.published_at, s.created_at)
from public.community_stories s
where not exists (
  select 1
  from public.community_story_review_history h
  where h.story_id = s.id
);

commit;
notify pgrst, 'reload schema';
