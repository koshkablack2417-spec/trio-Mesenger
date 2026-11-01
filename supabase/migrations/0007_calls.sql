-- Звонки: «звонок» = строка в calls. Второй человек видит её через realtime и получает входящий вызов.
-- Звук и видео идут через LiveKit, комната называется как id звонка.
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  caller_id uuid not null references public.profiles(id),
  callee_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'declined', 'ended', 'missed')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index on public.calls (callee_id, created_at desc);

alter table public.calls enable row level security;

create policy "participants read calls" on public.calls
  for select to authenticated using (caller_id = auth.uid() or callee_id = auth.uid());

-- Звонить можно только тому, кто состоит с тобой в одном чате
create policy "caller creates call" on public.calls
  for insert to authenticated with check (
    caller_id = auth.uid()
    and public.is_chat_member(chat_id)
    and exists (select 1 from public.chat_members m where m.chat_id = calls.chat_id and m.user_id = calls.callee_id)
  );

create policy "participants update calls" on public.calls
  for update to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid())
  with check (caller_id = auth.uid() or callee_id = auth.uid());

alter publication supabase_realtime add table public.calls;
