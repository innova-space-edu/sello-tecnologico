-- Espacio creativo: galeria de arte digital con revision humana obligatoria.
-- Ejecutar antes de activar las rutas de la galeria.
begin;

create table if not exists public.creative_space_works (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(trim(author_name)) between 2 and 120),
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 1200),
  media_type text not null check (media_type in ('image','video','audio')),
  mime_type text not null,
  file_name text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  storage_path text not null unique,
  rights_confirmed boolean not null default false,
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  constraint creative_published_reviewed check (status <> 'published' or (reviewed_by is not null and published_at is not null and rights_confirmed))
);

create index if not exists creative_space_published_idx
  on public.creative_space_works(published_at desc, id desc)
  where status = 'published';
create index if not exists creative_space_pending_idx
  on public.creative_space_works(created_at asc)
  where status = 'pending';

alter table public.creative_space_works enable row level security;
revoke all on public.creative_space_works from public, anon, authenticated;
grant select on public.creative_space_works to anon, authenticated;

create policy creative_public_read on public.creative_space_works
  for select to anon, authenticated using (status = 'published');
create policy creative_own_read on public.creative_space_works
  for select to authenticated using (uploader_id = (select auth.uid()));

-- Archivos privados: solo API con service_role puede firmar lecturas;
-- estudiantes y docentes pueden crear archivos en su propia carpeta, sin leer
-- carpetas ajenas ni sobrescribir contenidos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creative-space', 'creative-space', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','audio/mpeg','audio/mp4',
    'audio/wav','audio/ogg','audio/webm']::text[]
)
on conflict (id) do nothing;

create policy creative_space_upload_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'creative-space'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
