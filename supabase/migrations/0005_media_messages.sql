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
