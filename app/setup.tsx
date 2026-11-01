import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, ErrorText, Input, Screen } from '../components/ui';
import { useAuth } from '../lib/auth';
import { saveProfile } from '../lib/profile';
import { colors } from '../lib/theme';

/** Первый вход: имя и юзернейм (как в демо-версии). */
export default function Setup() {
  const { session, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!session) return;
    setError(null);
    setLoading(true);
    try {
      await saveProfile(session.user.id, name, username);
      await refreshProfile();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>Добро пожаловать в Трио</Text>
      <Text style={{ color: colors.muted }}>
        Имя увидят твои контакты. По юзернейму тебя смогут найти и добавить.
      </Text>
      <Input value={name} onChangeText={setName} placeholder="Имя" autoCapitalize="words" />
      <Input
        value={username}
        onChangeText={setUsername}
        placeholder="Юзернейм, например ivan_p"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Начать" onPress={submit} loading={loading} />
    </Screen>
  );
}
