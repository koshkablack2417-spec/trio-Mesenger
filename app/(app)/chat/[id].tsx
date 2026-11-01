import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MessageBubble } from '../../../components/MessageBubble';
import { Button, ErrorText, Input } from '../../../components/ui';
import { useAuth } from '../../../lib/auth';
import {
  type Message,
  getChatLabel,
  listMessages,
  sendContactMessage,
  sendMessage,
  sendTextMessage,
  subscribeToMessages,
} from '../../../lib/chats';
import { type CallKind, startCall } from '../../../lib/calls';
import { pickContact } from '../../../lib/contacts';
import {
  type PickedMedia,
  pickPhoto,
  pickVideo,
  recordCircle,
  uploadMedia,
} from '../../../lib/media';
import { colors } from '../../../lib/theme';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const me = session?.user.id ?? '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('Чат');
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (id && me) getChatLabel(id, me).then(setTitle).catch(() => {});
  }, [id, me]);

  useEffect(() => {
    if (!id) return;
    listMessages(id)
      .then(setMessages)
      .catch((e: Error) => setError(e.message));
    return subscribeToMessages(id, (m) =>
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
    );
  }, [id]);

  async function call(kind: CallKind) {
    if (!id || !me) return;
    setError(null);
    try {
      const callId = await startCall(id, me, kind);
      router.push({ pathname: '/call/[id]', params: { id: callId } });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || !id || !me) return;
    setText('');
    try {
      await sendTextMessage(id, me, body);
    } catch (e) {
      setError((e as Error).message);
      setText(body);
    }
  }

  /** Общая обёртка: закрыть меню, показать «Отправка…», поймать ошибку. */
  async function run(action: () => Promise<void>) {
    setError(null);
    setMenuOpen(false);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendMedia(pick: () => Promise<PickedMedia | null>) {
    await run(async () => {
      if (!id || !me) return;
      const media = await pick();
      if (!media) return;
      const path = await uploadMedia(id, media);
      await sendMessage({
        chatId: id,
        senderId: me,
        kind: media.kind,
        mediaPath: path,
        meta: {
          duration_ms: media.durationMs,
          width: media.width,
          height: media.height,
        },
      });
    });
  }

  async function sendContact() {
    await run(async () => {
      if (!id || !me) return;
      const contact = await pickContact();
      if (!contact) return;
      await sendContactMessage(id, me, contact);
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable onPress={() => void call('audio')} accessibilityLabel="Звонок">
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Звонок</Text>
              </Pressable>
              <Pressable onPress={() => void call('video')} accessibilityLabel="Видеозвонок">
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Видео</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 6 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => <MessageBubble message={item} mine={item.sender_id === me} />}
      />
      {busy && <Text style={styles.busy}>Отправка…</Text>}
      <ErrorText>{error}</ErrorText>

      {menuOpen && (
        <View style={styles.menu}>
          <View style={styles.menuItem}>
            <Button title="Фото" variant="secondary" onPress={() => void sendMedia(pickPhoto)} />
          </View>
          <View style={styles.menuItem}>
            <Button title="Видео" variant="secondary" onPress={() => void sendMedia(pickVideo)} />
          </View>
          <View style={styles.menuItem}>
            <Button title="Кружок" variant="secondary" onPress={() => void sendMedia(recordCircle)} />
          </View>
          <View style={styles.menuItem}>
            <Button title="Контакт" variant="secondary" onPress={() => void sendContact()} />
          </View>
        </View>
      )}

      <View style={styles.composer}>
        <Button
          title={menuOpen ? '×' : '+'}
          variant="secondary"
          onPress={() => setMenuOpen((v) => !v)}
          disabled={busy}
        />
        <View style={{ flex: 1 }}>
          <Input value={text} onChangeText={setText} placeholder="Сообщение" onSubmitEditing={send} />
        </View>
        <Button title="→" onPress={send} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  composer: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center' },
  menu: { flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  menuItem: { flex: 1 },
  busy: { color: colors.muted, textAlign: 'center', paddingVertical: 4 },
});
