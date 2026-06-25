-- Interacciones por publicación, audio, video o archivo dentro de la página pública.
-- Permite que cada bloque tenga sus propios me gusta, comentarios y vistas.

alter table public.project_public_pages
  add column if not exists background_color text not null default '#f8fafc',
  add column if not exists text_color text not null default '#0f172a',
  add column if not exists card_color text not null default '#ffffff',
  add column if not exists surface_style text not null default 'glass',
  add column if not exists button_style text not null default 'gradient',
  add column if not exists header_style text not null default 'large';

alter table public.project_public_page_comments
  add column if not exists block_id uuid references public.project_public_blocks(id) on delete cascade,
  add column if not exists asset_id uuid references public.project_public_assets(id) on delete cascade;

alter table public.project_public_page_likes
  add column if not exists block_id uuid references public.project_public_blocks(id) on delete cascade,
  add column if not exists asset_id uuid references public.project_public_assets(id) on delete cascade;

alter table public.project_public_page_views
  add column if not exists block_id uuid references public.project_public_blocks(id) on delete cascade,
  add column if not exists asset_id uuid references public.project_public_assets(id) on delete cascade;

create index if not exists idx_project_public_comments_block_id on public.project_public_page_comments(block_id, created_at desc);
create index if not exists idx_project_public_comments_asset_id on public.project_public_page_comments(asset_id, created_at desc);
create index if not exists idx_project_public_likes_block_id on public.project_public_page_likes(block_id);
create index if not exists idx_project_public_likes_asset_id on public.project_public_page_likes(asset_id);
create index if not exists idx_project_public_views_block_id on public.project_public_page_views(block_id, created_at desc);
create index if not exists idx_project_public_views_asset_id on public.project_public_page_views(asset_id, created_at desc);

-- El índice anterior solo permitía un like por página. Ahora se permite uno por página, bloque o archivo.
drop index if exists public.idx_project_public_likes_visitor_unique;
drop index if exists public.idx_project_public_likes_profile_unique;

create unique index if not exists idx_project_public_likes_visitor_target_unique
  on public.project_public_page_likes(
    page_id,
    coalesce(block_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(asset_id, '00000000-0000-0000-0000-000000000000'::uuid),
    visitor_key
  )
  where visitor_key is not null;

create unique index if not exists idx_project_public_likes_profile_target_unique
  on public.project_public_page_likes(
    page_id,
    coalesce(block_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(asset_id, '00000000-0000-0000-0000-000000000000'::uuid),
    profile_id
  )
  where profile_id is not null;
