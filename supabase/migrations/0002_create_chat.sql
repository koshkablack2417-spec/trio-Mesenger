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
