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
