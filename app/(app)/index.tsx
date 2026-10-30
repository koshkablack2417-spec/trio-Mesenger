import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText } from '../../components/ui';
import { type ChatSummary, listChats } from '../../lib/chats';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

const KIND_LABEL: Record<ChatSummary['kind'], string> = {
  direct: 'Личный чат',
  group: 'Группа',
  channel: 'Канал',
};

export default function ChatList() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      listChats()
        .then(setChats)
        .catch((e: Error) => setError(e.message));
    }, []),
  );

  return (
    <View style={styles.container}>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={chats}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={
          <Text style={styles.empty}>Чатов пока нет. Создай первый.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
          >
            <Text style={styles.title}>{item.title ?? KIND_LABEL[item.kind]}</Text>
            <Text style={styles.kind}>{KIND_LABEL[item.kind]}</Text>
          </Pressable>
        )}
      />
      <View style={styles.actions}>
        <Button title="Новый чат" onPress={() => router.push('/new-chat')} />
        <Button title="Выйти" variant="secondary" onPress={() => supabase.auth.signOut()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  row: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '600' },
  kind: { color: colors.muted, fontSize: 13, marginTop: 2 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  actions: { gap: 8 },
});
