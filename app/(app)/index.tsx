import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorText } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { type ChatSummary, listChats } from '../../lib/chats';
import { colors } from '../../lib/theme';

const KIND_LABEL: Record<ChatSummary['kind'], string> = {
  direct: 'Личный чат',
  group: 'Группа',
  channel: 'Канал',
};

export default function ChatList() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const me = session?.user.id ?? '';
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!me) return;
      listChats(me)
        .then(setChats)
        .catch((e: Error) => setError(e.message));
    }, [me]),
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: profile?.display_name ? `Трио · ${profile.display_name}` : 'Трио',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <Pressable onPress={() => router.push('/new-chat')} accessibilityLabel="Новый чат">
                <Text style={styles.hbtn}>Новый чат</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/settings')} accessibilityLabel="Настройки">
                <Text style={styles.hbtn}>Настройки</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={chats}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={
          <Text style={styles.empty}>Чатов пока нет. Нажми «Новый чат» сверху.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
          >
            <View style={[styles.ava, { backgroundColor: avaColor(item.label) }]}>
              <Text style={styles.avaText}>{item.label.replace('@', '').slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.label}</Text>
            <Text style={styles.kind}>{KIND_LABEL[item.kind]}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const AV = ['#E17076', '#FAA774', '#A695E7', '#7BC862', '#6EC9CB', '#65AADD', '#EE7AAE'];
function avaColor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
}

const styles = StyleSheet.create({
  hbtn: { color: colors.primary, fontWeight: '600' },
  ava: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avaText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  container: { flex: 1, padding: 16, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
