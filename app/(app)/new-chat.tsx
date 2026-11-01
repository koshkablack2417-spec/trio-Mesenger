import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, ErrorText, Input, Screen } from '../../components/ui';
import {
  type ChatKind,
  GROUP_MAX_MEMBERS,
  addMemberByPhone,
  createChat,
  findUserByPhone,
} from '../../lib/chats';
import { findUserByUsername } from '../../lib/profile';
import { colors } from '../../lib/theme';

/** Разбирает список номеров из текста: через запятую, пробел или с новой строки. */
function parsePhones(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((p) => p.replace(/[^\d+]/g, ''))
    .filter((p) => p.length > 0);
}

export default function NewChat() {
  const router = useRouter();
  const [kind, setKind] = useState<ChatKind>('direct');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [members, setMembers] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialId, setPartialId] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setPartialId(null);
    setLoading(true);
    try {
      if (kind === 'direct') {
        const q = phone.trim();
        const byName = q.startsWith('@') || /[a-z_]/i.test(q);
        const other = byName ? await findUserByUsername(q) : await findUserByPhone(q);
        if (!other) throw new Error(byName ? `Пользователь ${q} не найден в Трио` : 'Пользователь с таким номером не найден в Трио');
        const id = await createChat('direct', undefined, other);
        router.replace({ pathname: '/chat/[id]', params: { id } });
        return;
      }

      if (!title.trim()) throw new Error('Введи название');
      const phones = kind === 'group' ? parsePhones(members) : [];
      // Владелец тоже участник, поэтому считаем его в лимите.
      if (phones.length + 1 > GROUP_MAX_MEMBERS) {
        throw new Error(`В группе может быть не больше ${GROUP_MAX_MEMBERS} участников, включая тебя`);
      }

      const id = await createChat(kind, title.trim());
      const failed: string[] = [];
      for (const p of phones) {
        try {
          await addMemberByPhone(id, p);
        } catch {
          failed.push(p);
        }
      }
      if (failed.length > 0) {
        setPartialId(id);
        throw new Error(`Чат создан, но не добавлены: ${failed.join(', ')}`);
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
          <Text style={{ color: colors.muted }}>Юзернейм (@name) или номер собеседника (международный формат).</Text>
          <Input
            value={phone}
            onChangeText={setPhone}
            placeholder="@username или +34600111222"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      ) : (
        <>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder={kind === 'group' ? 'Название группы' : 'Название канала'}
          />
          {kind === 'group' && (
            <>
              <Text style={{ color: colors.muted }}>
                Номера участников через запятую, до {GROUP_MAX_MEMBERS - 1} человек (ты уже в группе).
              </Text>
              <Input
                value={members}
                onChangeText={setMembers}
                placeholder="+34600111222, +79001234567"
                keyboardType="phone-pad"
                multiline
                style={{ minHeight: 90, textAlignVertical: 'top' }}
              />
            </>
          )}
        </>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Создать" onPress={submit} loading={loading} />
      {partialId && (
        <Button
          title="Открыть группу"
          variant="secondary"
          onPress={() => router.replace({ pathname: '/chat/[id]', params: { id: partialId } })}
        />
      )}
    </Screen>
  );
}
