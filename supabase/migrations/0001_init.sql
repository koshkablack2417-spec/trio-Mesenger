-- Трио: начальная схема. Выполни в Supabase -> SQL Editor.

create extension if not exists "pgcrypto";

-- Профили
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  username text unique,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now()
);

-- Чаты: личные (direct), группы (group), каналы (channel)
create type public.chat_kind as enum ('direct', 'group', 'channel');
create type public.member_role as enum ('owner', 'admin', 'member');

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  kind public.chat_kind not null,
  title text,
  avatar_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index on public.chat_members (user_id);

-- Сообщения (text, video_circle = видеокружок, image, file)
create type public.message_kind as enum ('text', 'video_circle', 'image', 'file');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  kind public.message_kind not null default 'text',
  body text,
  media_path text,
  created_at timestamptz not null default now()
);
create index on public.messages (chat_id, created_at desc);

-- Вход на iPad / компьютере по QR-коду
create table public.qr_sessions (
  id uuid primary key default gen_random_uuid(),
  secret text not null default encode(gen_random_bytes(16), 'hex'),
  approved_by uuid references public.profiles(id),
  device_name text,
  expires_at timestamptz not null default now() + interval '2 minutes',
  created_at timestamptz not null default now()
);

-- Настройки пользователя (иконка приложения, звуки)
create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  app_icon text not null default 'three_dark',
  message_sound text not null default 'pam_pam',
  ringtone text not null default 'default'
);

-- Автосоздание профиля при регистрации
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, display_name)
  values (new.id, new.phone, coalesce(new.raw_user_meta_data->>'display_name', ''));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Вспомогательная проверка участия (security definer, чтобы не зацикливать RLS)
create or replace function public.is_chat_member(p_chat uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_members
    where chat_id = p_chat and user_id = auth.uid()
  );
$$;

-- Безопасность на уровне строк
alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.qr_sessions enable row level security;
alter table public.user_settings enable row level security;

create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid());

create policy "members read chats" on public.chats
  for select to authenticated using (public.is_chat_member(id));
create policy "create chats" on public.chats
  for insert to authenticated with check (created_by = auth.uid());

create policy "members read members" on public.chat_members
  for select to authenticated using (public.is_chat_member(chat_id));
create policy "owner adds members" on public.chat_members
  for insert to authenticated with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.chat_members m
      where m.chat_id = chat_members.chat_id
        and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );

create policy "members read messages" on public.messages
  for select to authenticated using (public.is_chat_member(chat_id));
-- В каналах писать могут только владелец и админы
create policy "members send messages" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and public.is_chat_member(chat_id)
    and (
      (select kind from public.chats c where c.id = chat_id) <> 'channel'
      or exists (
        select 1 from public.chat_members m
        where m.chat_id = messages.chat_id
          and m.user_id = auth.uid() and m.role in ('owner', 'admin')
      )
    )
  );

create policy "own settings" on public.user_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- QR: любой может создать сессию (устройство ещё не вошло), одобряет вошедший телефон.
-- Подробная реализация вынесена в Edge Function, прямого доступа у клиентов нет.

-- Realtime для сообщений
alter publication supabase_realtime add table public.messages;
