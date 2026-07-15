-- Feed social público unificado para todas las páginas publicadas.
-- Combina bloques y archivos, incluye metadatos de página y estadísticas por publicación.

create index if not exists idx_project_public_pages_public_feed
  on public.project_public_pages(published_at desc, id desc)
  where is_public = true and status = 'published';

create index if not exists idx_project_public_blocks_feed_created
  on public.project_public_blocks(page_id, created_at desc, id desc);

create index if not exists idx_project_public_assets_feed_created
  on public.project_public_assets(page_id, created_at desc, id desc);

create or replace view public.public_social_feed
with (security_invoker = true)
as
with likes_by_block as (
  select block_id, count(*)::bigint as total
  from public.project_public_page_likes
  where block_id is not null
  group by block_id
),
likes_by_asset as (
  select asset_id, count(*)::bigint as total
  from public.project_public_page_likes
  where asset_id is not null
  group by asset_id
),
comments_by_block as (
  select block_id, count(*)::bigint as total
  from public.project_public_page_comments
  where block_id is not null and is_hidden = false
  group by block_id
),
comments_by_asset as (
  select asset_id, count(*)::bigint as total
  from public.project_public_page_comments
  where asset_id is not null and is_hidden = false
  group by asset_id
),
views_by_block as (
  select block_id, count(*)::bigint as total
  from public.project_public_page_views
  where block_id is not null
  group by block_id
),
views_by_asset as (
  select asset_id, count(*)::bigint as total
  from public.project_public_page_views
  where asset_id is not null
  group by asset_id
)
select
  'asset'::text as item_type,
  a.id as item_id,
  ('asset:' || a.id::text) as item_key,
  p.id as page_id,
  p.slug as page_slug,
  regexp_replace(p.title, '^Vitrina:\s*', '', 'i') as page_title,
  p.description as page_description,
  coalesce(pr.full_name, 'Sello Tecnológico') as author_name,
  p.project_id,
  proj.title as project_title,
  p.course_id,
  c.name as course_name,
  coalesce(a.title, a.file_name) as title,
  a.description as content,
  a.file_type as media_type,
  null::text as block_type,
  a.id as asset_id,
  a.created_at as published_at,
  p.theme_color,
  p.accent_color,
  p.background_color,
  p.text_color,
  p.card_color,
  coalesce(lb.total, 0)::bigint as likes_count,
  coalesce(cb.total, 0)::bigint as comments_count,
  coalesce(vb.total, 0)::bigint as views_count,
  (coalesce(lb.total, 0) * 3 + coalesce(cb.total, 0) * 2 + coalesce(vb.total, 0))::bigint as trend_score
from public.project_public_assets a
join public.project_public_pages p on p.id = a.page_id
left join public.projects proj on proj.id = p.project_id
left join public.courses c on c.id = p.course_id
left join public.profiles pr on pr.id = p.created_by
left join likes_by_asset lb on lb.asset_id = a.id
left join comments_by_asset cb on cb.asset_id = a.id
left join views_by_asset vb on vb.asset_id = a.id
where p.is_public = true and p.status = 'published'

union all

select
  'block'::text as item_type,
  b.id as item_id,
  ('block:' || b.id::text) as item_key,
  p.id as page_id,
  p.slug as page_slug,
  regexp_replace(p.title, '^Vitrina:\s*', '', 'i') as page_title,
  p.description as page_description,
  coalesce(pr.full_name, 'Sello Tecnológico') as author_name,
  p.project_id,
  proj.title as project_title,
  p.course_id,
  c.name as course_name,
  coalesce(b.title,
    case
      when b.type = 'podcast_episode' then 'Episodio de podcast'
      when b.type = 'audio' then 'Audio'
      when b.type = 'video' then 'Video'
      when b.type = 'gallery' then 'Galería'
      else 'Publicación'
    end
  ) as title,
  b.content,
  case
    when b.type in ('audio', 'podcast_episode') then 'audio'
    when b.type = 'video' then 'video'
    when b.type = 'gallery' then 'image'
    when b.type = 'file_download' then 'file'
    else 'text'
  end as media_type,
  b.type as block_type,
  null::uuid as asset_id,
  b.created_at as published_at,
  p.theme_color,
  p.accent_color,
  p.background_color,
  p.text_color,
  p.card_color,
  coalesce(lb.total, 0)::bigint as likes_count,
  coalesce(cb.total, 0)::bigint as comments_count,
  coalesce(vb.total, 0)::bigint as views_count,
  (coalesce(lb.total, 0) * 3 + coalesce(cb.total, 0) * 2 + coalesce(vb.total, 0))::bigint as trend_score
from public.project_public_blocks b
join public.project_public_pages p on p.id = b.page_id
left join public.projects proj on proj.id = p.project_id
left join public.courses c on c.id = p.course_id
left join public.profiles pr on pr.id = p.created_by
left join likes_by_block lb on lb.block_id = b.id
left join comments_by_block cb on cb.block_id = b.id
left join views_by_block vb on vb.block_id = b.id
where p.is_public = true and p.status = 'published';

grant select on public.public_social_feed to anon, authenticated;

comment on view public.public_social_feed is
  'Feed cronológico unificado de bloques y archivos pertenecientes a páginas públicas publicadas.';
