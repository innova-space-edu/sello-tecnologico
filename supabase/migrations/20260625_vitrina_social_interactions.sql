-- Mejoras sociales y de diseño para Vitrina de Proyectos
-- Agrega comentarios, me gusta, vistas y opciones visuales editables.

alter table public.project_public_pages
  add column if not exists layout_style text not null default 'magazine',
  add column if not exists background_style text not null default 'soft_gradient',
  add column if not exists font_style text not null default 'modern',
  add column if not exists hero_badge text,
  add column if not exists call_to_action_label text,
  add column if not exists call_to_action_url text,
  add column if not exists show_author boolean not null default true,
  add column if not exists show_trending boolean not null default true;

create table if not exists public.project_public_page_comments (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.project_public_pages(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  visitor_name text,
  content text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.project_public_page_likes (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.project_public_pages(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  visitor_key text,
  created_at timestamptz not null default now(),
  constraint project_public_page_likes_identity_check check (profile_id is not null or visitor_key is not null)
);

create table if not exists public.project_public_page_views (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.project_public_pages(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  visitor_key text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_public_comments_page_id on public.project_public_page_comments(page_id, created_at desc);
create index if not exists idx_project_public_likes_page_id on public.project_public_page_likes(page_id);
create index if not exists idx_project_public_views_page_id on public.project_public_page_views(page_id, created_at desc);
create unique index if not exists idx_project_public_likes_visitor_unique
  on public.project_public_page_likes(page_id, visitor_key)
  where visitor_key is not null;
create unique index if not exists idx_project_public_likes_profile_unique
  on public.project_public_page_likes(page_id, profile_id)
  where profile_id is not null;

alter table public.project_public_page_comments enable row level security;
alter table public.project_public_page_likes enable row level security;
alter table public.project_public_page_views enable row level security;

-- Lectura pública de comentarios visibles en páginas publicadas.
drop policy if exists "public can read published comments" on public.project_public_page_comments;
create policy "public can read published comments"
on public.project_public_page_comments for select
using (
  is_hidden = false and exists (
    select 1 from public.project_public_pages p
    where p.id = page_id and p.is_public = true and p.status = 'published'
  )
);

-- Inserción pública controlada por API o cliente anon para comentarios en páginas publicadas.
drop policy if exists "public can insert comments on published pages" on public.project_public_page_comments;
create policy "public can insert comments on published pages"
on public.project_public_page_comments for insert
with check (
  is_hidden = false and exists (
    select 1 from public.project_public_pages p
    where p.id = page_id and p.is_public = true and p.status = 'published'
  )
);

-- Staff puede leer y moderar comentarios.
drop policy if exists "staff can manage public comments" on public.project_public_page_comments;
create policy "staff can manage public comments"
on public.project_public_page_comments for all
to authenticated
using (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('admin', 'docente', 'coordinador', 'utp')))
with check (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('admin', 'docente', 'coordinador', 'utp')));

-- Likes y views se administran principalmente por API con service role.
drop policy if exists "public can read likes" on public.project_public_page_likes;
create policy "public can read likes"
on public.project_public_page_likes for select
using (exists (select 1 from public.project_public_pages p where p.id = page_id and p.is_public = true and p.status = 'published'));

drop policy if exists "public can read views" on public.project_public_page_views;
create policy "public can read views"
on public.project_public_page_views for select
using (exists (select 1 from public.project_public_pages p where p.id = page_id and p.is_public = true and p.status = 'published'));

-- Vista para trending público.
create or replace view public.project_public_page_trending as
select
  p.id,
  p.title,
  p.slug,
  p.description,
  p.theme_color,
  p.accent_color,
  p.published_at,
  coalesce(l.likes_count, 0)::integer as likes_count,
  coalesce(v.views_count, 0)::integer as views_count,
  coalesce(c.comments_count, 0)::integer as comments_count,
  (coalesce(l.likes_count, 0) * 3 + coalesce(c.comments_count, 0) * 2 + coalesce(v.views_count, 0))::integer as trend_score
from public.project_public_pages p
left join (
  select page_id, count(*) as likes_count
  from public.project_public_page_likes
  group by page_id
) l on l.page_id = p.id
left join (
  select page_id, count(*) as views_count
  from public.project_public_page_views
  group by page_id
) v on v.page_id = p.id
left join (
  select page_id, count(*) as comments_count
  from public.project_public_page_comments
  where is_hidden = false
  group by page_id
) c on c.page_id = p.id
where p.is_public = true and p.status = 'published';
