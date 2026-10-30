import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, ErrorText, Input, Screen } from '../../components/ui';
import { type ChatKind, createChat, findUserByPhone } from '../../lib/chats';
import { colors } from '../../lib/theme';

export default function NewChat() {
  const router = useRouter();
  const [kind, setKind] = useState<ChatKind>('direct');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      let id: string;
      if (kind === 'direct') {
        const other = await findUserByPhone(phone);
        if (!other) throw new Error('Пользователь с таким номером не найден в Трио');
        id = await createChat('direct', undefined, other);
      } else {
        if (!title.trim()) throw new Error('Введи название');
        id = await createChat(kind, title.trim());
      }
      router.replace({ pathname: '/chat/[id]', params: { id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['direct', 'group', 'channel'] as const).map((k) => (
          <View key={k} style={{ flex: 1 }}>
            <Button
              title={k === 'direct' ? 'Личный' : k === 'group' ? 'Группа' : 'Канал'}
              variant={kind === k ? 'primary' : 'secondary'}
              onPress={() => setKind(k)}
            />
          </View>
        ))}
      </View>

      {kind === 'direct' ? (
        <>
          <Text style={{ color: colors.muted }}>Номер собеседника (международный формат).</Text>
          <Input
            value={phone}
            onChangeText={setPhone}
            placeholder="+34600111222"
            keyboardType="phone-pad"
          />
        </>
      ) : (
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder={kind === 'group' ? 'Название группы' : 'Название канала'}
        />
      )}
      <ErrorText>{error}</ErrorText>
      <Button title="Создать" onPress={submit} loading={loading} />
    </Screen>
  );
}
