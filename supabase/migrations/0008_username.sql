-- Поиск по юзернейму и проверка формата
alter table public.profiles
  add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_]{3,32}$');

create or replace function public.find_user_by_username(p_username text)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where username = lower(regexp_replace(p_username, '^@', '')) limit 1;
$$;
revoke execute on function public.find_user_by_username(text) from public, anon;
grant execute on function public.find_user_by_username(text) to authenticated;
