-- ================================================================
-- Metadatos para moderacion avanzada y vista de agresiones
-- Ejecutar despues de la migracion que crea flagged_messages.
-- ================================================================

begin;

alter table public.flagged_messages
  add column if not exists message_id uuid references public.messages(id) on delete set null,
  add column if not exists severity text,
  add column if not exists confidence numeric,
  add column if not exists action text,
  add column if not exists engine_version text,
  add column if not exists moderation_payload jsonb;

create index if not exists idx_flagged_messages_sender_created
  on public.flagged_messages(sender_id, created_at desc);

create index if not exists idx_flagged_messages_category_created
  on public.flagged_messages(category, created_at desc);

create index if not exists idx_flagged_messages_reviewed_created
  on public.flagged_messages(reviewed, created_at desc);

commit;
notify pgrst, 'reload schema';
