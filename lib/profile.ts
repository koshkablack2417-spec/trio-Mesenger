import { supabase } from './supabase';

export type Profile = {
  id: string;
  display_name: string;
  username: string | null;
  phone: string | null;
};

export const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, phone')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function saveProfile(userId: string, displayName: string, username: string) {
  const name = displayName.trim();
  const user = username.trim().replace(/^@/, '').toLowerCase();
  if (!name) throw new Error('Введи имя');
  if (!USERNAME_RE.test(user)) {
    throw new Error('Юзернейм: 3–32 символа, латинские буквы, цифры и _');
  }
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name, username: user })
    .eq('id', userId);
  if (error) {
    if (error.code === '23505') throw new Error(`Юзернейм @${user} уже занят`);
    throw error;
  }
}

export async function findUserByUsername(username: string) {
  const { data, error } = await supabase.rpc('find_user_by_username', { p_username: username });
  if (error) throw error;
  return (data as string | null) ?? null;
}
