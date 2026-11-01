import { supabase } from './supabase';

export type CallKind = 'audio' | 'video';
export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed';

export type Call = {
  id: string;
  chat_id: string;
  caller_id: string;
  callee_id: string;
  kind: CallKind;
  status: CallStatus;
  created_at: string;
};

/** Собеседник в личном чате. В группах и каналах звонков пока нет. */
export async function findCallee(chatId: string, me: string): Promise<string | null> {
  const { data: chat, error: e1 } = await supabase.from('chats').select('kind').eq('id', chatId).single();
  if (e1) throw e1;
  if (chat.kind !== 'direct') return null;
  const { data, error } = await supabase.from('chat_members').select('user_id').eq('chat_id', chatId);
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id as string).find((u) => u !== me) ?? null;
}

export async function startCall(chatId: string, me: string, kind: CallKind): Promise<string> {
  const callee = await findCallee(chatId, me);
  if (!callee) throw new Error('Звонить можно только в личном чате.');
  const { data, error } = await supabase
    .from('calls')
    .insert({ chat_id: chatId, caller_id: me, callee_id: callee, kind })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function setCallStatus(id: string, status: CallStatus) {
  const patch: Record<string, unknown> = { status };
  if (status === 'ended' || status === 'declined' || status === 'missed') {
    patch.ended_at = new Date().toISOString();
  }
  const { error } = await supabase.from('calls').update(patch).eq('id', id);
  if (error) throw error;
}

export async function getCall(id: string): Promise<Call> {
  const { data, error } = await supabase.from('calls').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Call;
}

/** Пропуск в комнату звонка. Секрет LiveKit хранится только на сервере (функция livekit-token). */
export async function getCallToken(callId: string): Promise<{ url: string; token: string }> {
  const { data, error } = await supabase.functions.invoke('livekit-token', { body: { room: callId } });
  if (error) throw error;
  if (!data?.token) throw new Error(data?.error ?? 'Сервер звонков не выдал пропуск');
  return data as { url: string; token: string };
}

/** Входящие звонки (пока приложение открыто) и изменения статуса. */
export function subscribeToIncoming(me: string, onCall: (c: Call) => void) {
  const channel = supabase
    .channel(`calls-in:${me}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${me}` },
      (p) => {
        const c = p.new as Call;
        if (c.status === 'ringing' && Date.now() - new Date(c.created_at).getTime() < 45_000) onCall(c);
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToCall(id: string, onChange: (c: Call) => void) {
  const channel = supabase
    .channel(`call:${id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${id}` },
      (p) => onChange(p.new as Call),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
