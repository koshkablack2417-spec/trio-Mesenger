-- Закрываем лишний доступ к служебным функциям (рекомендация Supabase Security Advisor).
-- Триггер handle_new_user вызывается самой базой, клиенту он не нужен.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- is_chat_member нужна только вошедшим пользователям (используется в политиках RLS).
revoke execute on function public.is_chat_member(uuid) from public, anon;
grant execute on function public.is_chat_member(uuid) to authenticated;
