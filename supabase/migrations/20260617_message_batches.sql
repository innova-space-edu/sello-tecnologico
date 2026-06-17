begin;

create extension if not exists pgcrypto;

create table if not exists public.message_batches (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  target_type text not null check (target_type in ('all', 'course', 'students', 'staff', 'selected')),
  course_name text,
  title text,
  content text not null,
  total_recipients integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.messages
  add column if not exists batch_id uuid references public.message_batches(id) on delete set null,
  add column if not exists message_kind text not null default 'direct' check (message_kind in ('direct', 'group'));

create index if not exists idx_message_batches_sender on public.message_batches(sender_id, created_at desc);
create index if not exists idx_messages_batch on public.messages(batch_id);

alter table public.message_batches enable row level security;

drop policy if exists message_batches_read_staff_or_sender on public.message_batches;
create policy message_batches_read_staff_or_sender on public.message_batches
for select to authenticated
using (sender_id = auth.uid());

revoke all on table public.message_batches from anon, authenticated;
grant select on table public.message_batches to authenticated;

commit;
notify pgrst, 'reload schema';
