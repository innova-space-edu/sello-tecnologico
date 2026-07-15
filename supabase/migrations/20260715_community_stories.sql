-- Historias públicas de la Comunidad Sello Tecnológico.
-- Las historias se publican inmediatamente y quedan pendientes de revisión interna.

begin;

create extension if not exists pgcrypto;

-- Permite que los avisos personales identifiquen revisiones de historias.
alter table public.user_notifications
  drop constraint if exists user_notifications_type_check;
alter table public.user_notifications
  add constraint user_notifications_type_check
  check (type in ('info','survey','followup','result','feedback','story_review'));

alter table public.user_notifications
  drop constraint if exists user_notifications_source_type_check;
alter table public.user_notifications
  add constraint user_notifications_source_type_check
  check (source_type is null or source_type in ('survey','followup','system','story'));

create table if not exists public.community_stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  page_id uuid references public.project_public_pages(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  title text,
  caption text,
  visibility_status text not null default 'published'
    check (visibility_status in ('published','hidden','deleted','expired')),
  review_status text not null default 'pending'
    check (review_status in ('pending','reviewed','flagged','correction_requested')),
  is_featured boolean not null default false,
  comments_enabled boolean not null default true,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  published_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_story_items (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.community_stories(id) on delete cascade,
  media_type text not null check (media_type in ('image','video')),
  storage_bucket text not null default 'community-stories',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  width integer,
  height integer,
  duration_seconds numeric(8,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.community_story_reactions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.community_stories(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  visitor_key text,
  emoji text not null check (emoji in ('❤️','👏','🔥','🌱','💡','🚀','😂','😮')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (profile_id is not null or visitor_key is not null)
);

create table if not exists public.community_story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.community_stories(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  visitor_key text,
  visitor_name text,
  content text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check (profile_id is not null or visitor_key is not null)
);

create table if not exists public.community_story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.community_stories(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  visitor_key text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.community_story_reports (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.community_stories(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  visitor_key text,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  check (profile_id is not null or visitor_key is not null)
);

create index if not exists idx_community_stories_public
  on public.community_stories(visibility_status, published_at desc);
create index if not exists idx_community_stories_review
  on public.community_stories(review_status, created_at desc);
create index if not exists idx_community_stories_author
  on public.community_stories(author_id, created_at desc);
create index if not exists idx_community_story_items_story
  on public.community_story_items(story_id, sort_order);
create index if not exists idx_community_story_reactions_story
  on public.community_story_reactions(story_id);
create index if not exists idx_community_story_comments_story
  on public.community_story_comments(story_id, created_at desc);
create index if not exists idx_community_story_views_story
  on public.community_story_views(story_id, created_at desc);
create index if not exists idx_community_story_reports_status
  on public.community_story_reports(status, created_at desc);

create unique index if not exists idx_story_reaction_profile_unique
  on public.community_story_reactions(story_id, profile_id)
  where profile_id is not null;
create unique index if not exists idx_story_reaction_visitor_unique
  on public.community_story_reactions(story_id, visitor_key)
  where visitor_key is not null;

alter table public.community_stories enable row level security;
alter table public.community_story_items enable row level security;
alter table public.community_story_reactions enable row level security;
alter table public.community_story_comments enable row level security;
alter table public.community_story_views enable row level security;
alter table public.community_story_reports enable row level security;

-- Historias publicadas: visibles de inmediato, aunque review_status siga pendiente.
drop policy if exists community_stories_public_read on public.community_stories;
create policy community_stories_public_read
on public.community_stories for select
using (
  visibility_status = 'published'
  and (is_featured = true or expires_at > now())
);

drop policy if exists community_story_items_public_read on public.community_story_items;
create policy community_story_items_public_read
on public.community_story_items for select
using (
  exists (
    select 1 from public.community_stories s
    where s.id = story_id
      and s.visibility_status = 'published'
      and (s.is_featured = true or s.expires_at > now())
  )
);

-- El autor puede crear y administrar sus propias historias.
drop policy if exists community_stories_author_insert on public.community_stories;
create policy community_stories_author_insert
on public.community_stories for insert to authenticated
with check (author_id = auth.uid() and visibility_status = 'published' and review_status = 'pending');

drop policy if exists community_stories_author_update on public.community_stories;
create policy community_stories_author_update
on public.community_stories for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists community_story_items_author_write on public.community_story_items;
create policy community_story_items_author_write
on public.community_story_items for all to authenticated
using (exists (select 1 from public.community_stories s where s.id = story_id and s.author_id = auth.uid()))
with check (exists (select 1 from public.community_stories s where s.id = story_id and s.author_id = auth.uid()));

-- Staff puede revisar, destacar, ocultar o restaurar historias.
drop policy if exists community_stories_staff_manage on public.community_stories;
create policy community_stories_staff_manage
on public.community_stories for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','docente','coordinador','utp')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','docente','coordinador','utp')));

-- Las interacciones visibles pueden leerse públicamente. Las escrituras se canalizan por API.
drop policy if exists community_story_reactions_public_read on public.community_story_reactions;
create policy community_story_reactions_public_read on public.community_story_reactions for select using (true);
drop policy if exists community_story_comments_public_read on public.community_story_comments;
create policy community_story_comments_public_read on public.community_story_comments for select using (is_hidden = false);
drop policy if exists community_story_views_staff_read on public.community_story_views;
create policy community_story_views_staff_read on public.community_story_views for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','docente','coordinador','utp')));
drop policy if exists community_story_reports_staff_manage on public.community_story_reports;
create policy community_story_reports_staff_manage on public.community_story_reports for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','docente','coordinador','utp')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','docente','coordinador','utp')));

grant select on public.community_stories, public.community_story_items,
  public.community_story_reactions, public.community_story_comments to anon, authenticated;
grant insert, update, delete on public.community_stories, public.community_story_items to authenticated;

-- Bucket privado; el contenido público se entrega mediante enlaces firmados desde la API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-stories',
  'community-stories',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_story_storage_insert_own on storage.objects;
create policy community_story_storage_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-stories'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists community_story_storage_select_own on storage.objects;
create policy community_story_storage_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'community-stories'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','docente','coordinador','utp'))
  )
);

drop policy if exists community_story_storage_delete_own on storage.objects;
create policy community_story_storage_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'community-stories'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','docente','coordinador','utp'))
  )
);

create or replace function public.set_community_story_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_community_story_updated_at on public.community_stories;
create trigger trg_community_story_updated_at
before update on public.community_stories
for each row execute function public.set_community_story_updated_at();

-- Al publicarse, la historia ya es visible y se genera un aviso de revisión para staff.
create or replace function public.notify_staff_new_community_story()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  staff record;
  author_name text;
begin
  select coalesce(full_name, 'Un usuario') into author_name
  from public.profiles where id = new.author_id;

  for staff in
    select id from public.profiles
    where role in ('admin','docente','coordinador','utp')
      and id <> new.author_id
  loop
    insert into public.user_notifications (
      user_id, title, message, type, source_type, source_id,
      dedupe_key, is_read, read_at, created_at, updated_at
    ) values (
      staff.id,
      'Nueva historia pendiente de revisión',
      author_name || ' publicó una historia que ya está visible en la Comunidad.',
      'story_review',
      'story',
      new.id,
      'story:review:' || new.id::text || ':' || staff.id::text,
      false, null, now(), now()
    )
    on conflict (dedupe_key) do update set
      title = excluded.title,
      message = excluded.message,
      is_read = false,
      read_at = null,
      updated_at = now();
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_staff_new_community_story on public.community_stories;
create trigger trg_notify_staff_new_community_story
after insert on public.community_stories
for each row execute function public.notify_staff_new_community_story();

create or replace view public.community_active_stories
with (security_invoker = true)
as
select
  s.*,
  coalesce(r.reactions_count, 0)::integer as reactions_count,
  coalesce(c.comments_count, 0)::integer as comments_count,
  coalesce(v.views_count, 0)::integer as views_count
from public.community_stories s
left join (
  select story_id, count(*) reactions_count
  from public.community_story_reactions group by story_id
) r on r.story_id = s.id
left join (
  select story_id, count(*) comments_count
  from public.community_story_comments where is_hidden = false group by story_id
) c on c.story_id = s.id
left join (
  select story_id, count(*) views_count
  from public.community_story_views group by story_id
) v on v.story_id = s.id
where s.visibility_status = 'published'
  and (s.is_featured = true or s.expires_at > now());

grant select on public.community_active_stories to anon, authenticated;

-- Realtime para refrescar el carrusel y el contador de revisión.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_stories'
  ) then
    alter publication supabase_realtime add table public.community_stories;
  end if;
end
$$;

commit;
notify pgrst, 'reload schema';
