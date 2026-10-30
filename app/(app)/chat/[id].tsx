import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText, Input } from '../../../components/ui';
import { useAuth } from '../../../lib/auth';
import {
  type Message,
  listMessages,
  sendTextMessage,
  subscribeToMessages,
} from '../../../lib/chats';
import { colors } from '../../../lib/theme';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (!id) return;
    listMessages(id)
      .then(setMessages)
      .catch((e: Error) => setError(e.message));
    return subscribeToMessages(id, (m) =>
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
    );
  }, [id]);

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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 6 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.sender_id === me;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.other]}>
              <Text style={styles.bubbleText}>
                {item.kind === 'text' ? item.body : `[${item.kind}]`}
              </Text>
            </View>
          );
        }}
      />
      <ErrorText>{error}</ErrorText>
      <View style={styles.composer}>
        <View style={{ flex: 1 }}>
          <Input value={text} onChangeText={setText} placeholder="Сообщение" onSubmitEditing={send} />
        </View>
        <Button title="→" onPress={send} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.bubbleMine },
  other: { alignSelf: 'flex-start', backgroundColor: colors.bubbleOther },
  bubbleText: { color: colors.text, fontSize: 16 },
  composer: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center' },
});
