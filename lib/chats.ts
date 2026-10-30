import { supabase } from './supabase';

export type ChatKind = 'direct' | 'group' | 'channel';

export type ChatSummary = {
  id: string;
  kind: ChatKind;
  title: string | null;
};

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  kind: 'text' | 'video_circle' | 'image' | 'file';
  body: string | null;
  media_path: string | null;
  created_at: string;
};

export async function listChats(): Promise<ChatSummary[]> {
  const { data, error } = await supabase
    .from('chats')
    .select('id, kind, title')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ChatSummary[];
}

export async function createChat(kind: ChatKind, title?: string, otherUser?: string) {
  const { data, error } = await supabase.rpc('create_chat', {
    p_kind: kind,
    p_title: title ?? null,
    p_other_user: otherUser ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function findUserByPhone(phone: string) {
  const { data, error } = await supabase.rpc('find_user_by_phone', { p_phone: phone });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function listMessages(chatId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendTextMessage(chatId: string, senderId: string, body: string) {
  const { error } = await supabase
    .from('messages')
    .insert({ chat_id: chatId, sender_id: senderId, kind: 'text', body });
  if (error) throw error;
}

export function subscribeToMessages(chatId: string, onInsert: (m: Message) => void) {
  const channel = supabase
    .channel(`messages:${chatId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
      (payload) => onInsert(payload.new as Message),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
