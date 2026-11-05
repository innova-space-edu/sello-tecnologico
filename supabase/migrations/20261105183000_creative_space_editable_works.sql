-- Edición de obras por el titular. La API gestiona moderación y privacidad.
begin;

alter table public.creative_space_works
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists updated_at timestamptz not null default now();

alter table public.creative_space_works
  add constraint creative_space_tags_limit
    check (cardinality(tags) <= 8 and char_length(array_to_string(tags, ',')) <= 240);

create index if not exists creative_space_owner_updated_idx
  on public.creative_space_works (uploader_id, updated_at desc);

-- No conceder SELECT/UPDATE a anon ni authenticated:
-- la edición se permite únicamente mediante la API con verificación de sesión,
-- titularidad, y reversión a revisión pendiente.
revoke all on public.creative_space_works from anon, authenticated;

commit;
