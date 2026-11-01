import { supabase } from './supabase';

export type ChatKind = 'direct' | 'group' | 'channel';

export type ChatSummary = {
  id: string;
  kind: ChatKind;
  title: string | null;
  /** Что показывать в списке: название или имя собеседника */
  label: string;
};

export type MessageKind = 'text' | 'image' | 'video' | 'video_circle' | 'contact' | 'file';

export type ContactMeta = { name: string; phones: string[] };

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  media_path: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export const MEDIA_BUCKET = 'chat-media';

type MemberRow = { user_id: string; profiles: { display_name: string; username: string | null } | null };

export function personLabel(p: { display_name: string; username: string | null } | null | undefined) {
  if (!p) return 'Пользователь';
  return p.display_name || (p.username ? `@${p.username}` : 'Пользователь');
}

export async function listChats(me: string): Promise<ChatSummary[]> {
  const { data, error } = await supabase
    .from('chats')
    .select('id, kind, title, chat_members(user_id, profiles(display_name, username))')
    .order('created_at', { ascending: false });
  if (error) throw error;
  type Row = { id: string; kind: ChatKind; title: string | null; chat_members: MemberRow[] };
  return ((data ?? []) as unknown as Row[]).map((c) => {
    const other = c.chat_members.find((m) => m.user_id !== me);
    const label =
      c.title ??
      (c.kind === 'direct' ? personLabel(other?.profiles) : c.kind === 'group' ? 'Группа' : 'Канал');
    return { id: c.id, kind: c.kind, title: c.title, label };
  });
}

/** Название чата для шапки */
export async function getChatLabel(chatId: string, me: string): Promise<string> {
  const all = await listChats(me);
  return all.find((c) => c.id === chatId)?.label ?? 'Чат';
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

type SendInput = {
  chatId: string;
  senderId: string;
  kind: MessageKind;
  body?: string | null;
  mediaPath?: string | null;
  meta?: Record<string, unknown>;
};

export async function sendMessage(input: SendInput) {
  const { error } = await supabase.from('messages').insert({
    chat_id: input.chatId,
    sender_id: input.senderId,
    kind: input.kind,
    body: input.body ?? null,
    media_path: input.mediaPath ?? null,
    meta: input.meta ?? {},
  });
  if (error) throw error;
}

export function sendTextMessage(chatId: string, senderId: string, body: string) {
  return sendMessage({ chatId, senderId, kind: 'text', body });
}

export function sendContactMessage(chatId: string, senderId: string, contact: ContactMeta) {
  return sendMessage({
    chatId,
    senderId,
    kind: 'contact',
    body: contact.name,
    meta: { name: contact.name, phones: contact.phones },
  });
}

/** Временная ссылка на файл из закрытого хранилища (действует 1 час). */
export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export function readContactMeta(meta: Record<string, unknown> | null): ContactMeta | null {
  if (!meta || typeof meta.name !== 'string') return null;
  const phones = Array.isArray(meta.phones)
    ? meta.phones.filter((p): p is string => typeof p === 'string')
    : [];
  return { name: meta.name, phones };
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

export const GROUP_MAX_MEMBERS = 300;

/** Добавляет участника по номеру телефона. Лимит проверяет база. */
export async function addMemberByPhone(chatId: string, phone: string) {
  const userId = await findUserByPhone(phone);
  if (!userId) throw new Error(`Нет пользователя с номером ${phone}`);
  const { error } = await supabase
    .from('chat_members')
    .insert({ chat_id: chatId, user_id: userId, role: 'member' });
  if (error) throw error;
}
