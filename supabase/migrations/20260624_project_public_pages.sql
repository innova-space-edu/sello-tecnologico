-- Vitrina pública de proyectos
-- Permite crear páginas públicas con link único para podcasts, videos, galerías, posts y materiales del proyecto.

create extension if not exists pgcrypto;

create table if not exists public.project_public_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  slug text not null unique,
  description text,
  cover_asset_id uuid,
  theme_color text default '#2563eb',
  accent_color text default '#0ea5e9',
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'hidden', 'archived')),
  is_public boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_public_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.project_public_pages(id) on delete cascade,
  type text not null default 'text' check (type in ('hero', 'text', 'post', 'podcast_episode', 'audio', 'video', 'gallery', 'file_download', 'team', 'timeline', 'credits', 'call_to_action')),
  title text,
  content text,
  sort_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_public_assets (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.project_public_pages(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_type text not null default 'file' check (file_type in ('image', 'audio', 'video', 'pdf', 'file')),
  mime_type text,
  file_size bigint,
  storage_bucket text not null default 'project-public-assets',
  storage_path text not null,
  title text,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.project_public_pages
  add constraint project_public_pages_cover_asset_fk
  foreign key (cover_asset_id) references public.project_public_assets(id) on delete set null;

create index if not exists idx_project_public_pages_project_id on public.project_public_pages(project_id);
create index if not exists idx_project_public_pages_slug on public.project_public_pages(slug);
create index if not exists idx_project_public_pages_status on public.project_public_pages(status);
create index if not exists idx_project_public_blocks_page_id on public.project_public_blocks(page_id);
create index if not exists idx_project_public_assets_page_id on public.project_public_assets(page_id);

alter table public.project_public_pages enable row level security;
alter table public.project_public_blocks enable row level security;
alter table public.project_public_assets enable row level security;

-- Lectura pública: solo páginas publicadas.
drop policy if exists "public can read published pages" on public.project_public_pages;
create policy "public can read published pages"
on public.project_public_pages for select
using (is_public = true and status = 'published');

drop policy if exists "public can read published blocks" on public.project_public_blocks;
create policy "public can read published blocks"
on public.project_public_blocks for select
using (
  exists (
    select 1 from public.project_public_pages p
    where p.id = page_id and p.is_public = true and p.status = 'published'
  )
);

drop policy if exists "public can read published assets" on public.project_public_assets;
create policy "public can read published assets"
on public.project_public_assets for select
using (
  exists (
    select 1 from public.project_public_pages p
    where p.id = page_id and p.is_public = true and p.status = 'published'
  )
);

-- Autenticados: pueden leer sus páginas; staff puede leer todo.
drop policy if exists "authenticated can read own or staff pages" on public.project_public_pages;
create policy "authenticated can read own or staff pages"
on public.project_public_pages for select
to authenticated
using (
  created_by = auth.uid()
  or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('admin', 'docente', 'coordinador', 'utp'))
);

drop policy if exists "authenticated can read related blocks" on public.project_public_blocks;
create policy "authenticated can read related blocks"
on public.project_public_blocks for select
to authenticated
using (
  exists (
    select 1 from public.project_public_pages p
    where p.id = page_id and (
      p.created_by = auth.uid()
      or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('admin', 'docente', 'coordinador', 'utp'))
    )
  )
);

drop policy if exists "authenticated can read related assets" on public.project_public_assets;
create policy "authenticated can read related assets"
on public.project_public_assets for select
to authenticated
using (
  exists (
    select 1 from public.project_public_pages p
    where p.id = page_id and (
      p.created_by = auth.uid()
      or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('admin', 'docente', 'coordinador', 'utp'))
    )
  )
);

-- Escritura: creador o staff.
drop policy if exists "authenticated can create public pages" on public.project_public_pages;
create policy "authenticated can create public pages"
on public.project_public_pages for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "owner or staff can update public pages" on public.project_public_pages;
create policy "owner or staff can update public pages"
on public.project_public_pages for update
to authenticated
using (
  created_by = auth.uid()
  or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('admin', 'docente', 'coordinador', 'utp'))
)
with check (
  created_by = auth.uid()
  or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('admin', 'docente', 'coordinador', 'utp'))
);

drop policy if exists "owner or staff can delete public pages" on public.project_public_pages;
create policy "owner or staff can delete public pages"
on public.project_public_pages for delete
to authenticated
using (
  created_by = auth.uid()
  or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('admin', 'docente', 'coordinador', 'utp'))
);

drop policy if exists "owner or staff can write blocks" on public.project_public_blocks;
create policy "owner or staff can write blocks"
on public.project_public_blocks for all
to authenticated
using (
  exists (
    select 1 from public.project_public_pages p
    where p.id = page_id and (
      p.created_by = auth.uid()
      or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('admin', 'docente', 'coordinador', 'utp'))
    )
  )
)
with check (
  exists (
    select 1 from public.project_public_pages p
    where p.id = page_id and (
      p.created_by = auth.uid()
      or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('admin', 'docente', 'coordinador', 'utp'))
    )
  )
);

drop policy if exists "owner or staff can write assets" on public.project_public_assets;
create policy "owner or staff can write assets"
on public.project_public_assets for all
to authenticated
using (
  exists (
    select 1 from public.project_public_pages p
    where p.id = page_id and (
      p.created_by = auth.uid()
      or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('admin', 'docente', 'coordinador', 'utp'))
    )
  )
)
with check (
  exists (
    select 1 from public.project_public_pages p
    where p.id = page_id and (
      p.created_by = auth.uid()
      or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('admin', 'docente', 'coordinador', 'utp'))
    )
  )
);

-- Bucket privado para archivos de vitrinas.
insert into storage.buckets (id, name, public)
values ('project-public-assets', 'project-public-assets', false)
on conflict (id) do nothing;

-- Políticas de storage para subida autenticada.
drop policy if exists "authenticated can upload project public assets" on storage.objects;
create policy "authenticated can upload project public assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'project-public-assets');

drop policy if exists "authenticated can read project public assets" on storage.objects;
create policy "authenticated can read project public assets"
on storage.objects for select
to authenticated
using (bucket_id = 'project-public-assets');

drop policy if exists "authenticated can update own project public assets" on storage.objects;
create policy "authenticated can update own project public assets"
on storage.objects for update
to authenticated
using (bucket_id = 'project-public-assets' and owner = auth.uid())
with check (bucket_id = 'project-public-assets' and owner = auth.uid());

drop policy if exists "authenticated can delete own project public assets" on storage.objects;
create policy "authenticated can delete own project public assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'project-public-assets' and owner = auth.uid());
