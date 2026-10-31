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
