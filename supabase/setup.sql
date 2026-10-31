-- Трио: вся схема одним файлом. Вставь в Supabase -> SQL Editor и нажми Run.


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
  secret text not null default encode(extensions.gen_random_bytes(16), 'hex'),
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

-- Создание чата одной транзакцией: чат + владелец (+ собеседник для личного чата).
create or replace function public.create_chat(
  p_kind public.chat_kind,
  p_title text default null,
  p_other_user uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_chat uuid;
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  if p_kind = 'direct' then
    if p_other_user is null or p_other_user = v_me then
      raise exception 'direct chat needs another user';
    end if;
    -- уже есть личный чат с этим человеком?
    select c.id into v_chat
    from public.chats c
    join public.chat_members a on a.chat_id = c.id and a.user_id = v_me
    join public.chat_members b on b.chat_id = c.id and b.user_id = p_other_user
    where c.kind = 'direct'
    limit 1;
    if v_chat is not null then
      return v_chat;
    end if;
  end if;

  insert into public.chats (kind, title, created_by)
  values (p_kind, p_title, v_me)
  returning id into v_chat;

  insert into public.chat_members (chat_id, user_id, role) values (v_chat, v_me, 'owner');
  if p_kind = 'direct' then
    insert into public.chat_members (chat_id, user_id, role) values (v_chat, p_other_user, 'member');
  end if;

  return v_chat;
end $$;

revoke execute on function public.create_chat(public.chat_kind, text, uuid) from public, anon;
grant execute on function public.create_chat(public.chat_kind, text, uuid) to authenticated;

-- Поиск человека по номеру телефона для личного чата
create or replace function public.find_user_by_phone(p_phone text)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where phone = regexp_replace(p_phone, '\D', '', 'g') limit 1;
$$;

revoke execute on function public.find_user_by_phone(text) from public, anon;
grant execute on function public.find_user_by_phone(text) to authenticated;

-- Закрываем лишний доступ к служебным функциям (рекомендация Supabase Security Advisor).
-- Триггер handle_new_user вызывается самой базой, клиенту он не нужен.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- is_chat_member нужна только вошедшим пользователям (используется в политиках RLS).
revoke execute on function public.is_chat_member(uuid) from public, anon;
grant execute on function public.is_chat_member(uuid) to authenticated;
-- Когда пользователь добавляет или меняет номер телефона (экран «Защити аккаунт»),
-- копируем его в profiles.phone, чтобы по номеру можно было найти человека для чата.
create or replace function public.sync_profile_phone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set phone = new.phone where id = new.id;
  return new;
end $$;

create trigger on_auth_user_phone_updated
  after update of phone on auth.users
  for each row
  when (old.phone is distinct from new.phone)
  execute function public.sync_profile_phone();

revoke execute on function public.sync_profile_phone() from public, anon, authenticated;

-- Фото, видео, видеокружки и контакты в сообщениях.

alter type public.message_kind add value if not exists 'video';
alter type public.message_kind add value if not exists 'contact';

-- Дополнительные данные сообщения (для контакта: имя и номера)
alter table public.messages add column if not exists meta jsonb not null default '{}'::jsonb;

-- Закрытое хранилище для медиа. Файлы лежат в папках по id чата: <chat_id>/<файл>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 52428800, array['image/*', 'video/*'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Читать и загружать файлы могут только участники этого чата
create policy "chat members read media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and public.is_chat_member(((storage.foldername(name))[1])::uuid)
  );

create policy "chat members upload media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.is_chat_member(((storage.foldername(name))[1])::uuid)
  );

-- Лимит участников группы и канала: не больше 300 (включая владельца).
-- Личные чаты не ограничиваются. Проверка на уровне базы, поэтому обойти её из приложения нельзя.
create or replace function public.enforce_group_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_kind public.chat_kind;
  v_count int;
begin
  select kind into v_kind from public.chats where id = new.chat_id;
  if v_kind = 'direct' then
    return new;
  end if;
  select count(*) into v_count from public.chat_members where chat_id = new.chat_id;
  if v_count >= 300 then
    raise exception 'В группе не может быть больше 300 участников';
  end if;
  return new;
end $$;

drop trigger if exists chat_members_limit on public.chat_members;
create trigger chat_members_limit
  before insert on public.chat_members
  for each row execute function public.enforce_group_limit();

revoke execute on function public.enforce_group_limit() from public, anon, authenticated;
