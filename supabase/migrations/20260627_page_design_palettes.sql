-- Paletas prediseñadas y estilos visuales completos para páginas públicas.
-- Asegura que las páginas puedan guardar fondo, texto, tarjetas y estilos.

alter table public.project_public_pages
  add column if not exists background_color text default '#f8fafc',
  add column if not exists text_color text default '#0f172a',
  add column if not exists card_color text default '#ffffff',
  add column if not exists surface_style text default 'flat',
  add column if not exists button_style text default 'solid',
  add column if not exists header_style text default 'large';

update public.project_public_pages
set
  background_color = coalesce(background_color, '#f8fafc'),
  text_color = coalesce(text_color, '#0f172a'),
  card_color = coalesce(card_color, '#ffffff'),
  surface_style = coalesce(surface_style, 'flat'),
  button_style = coalesce(button_style, 'solid'),
  header_style = coalesce(header_style, 'large'),
  background_style = coalesce(background_style, 'solid')
where true;
