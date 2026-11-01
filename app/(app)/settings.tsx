import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText, Input, Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { saveProfile } from '../../lib/profile';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

export default function Settings() {
  const { session, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!session) return;
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      await saveProfile(session.user.id, name, username);
      await refreshProfile();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen top>
      <Text style={styles.section}>Профиль</Text>
      <Input value={name} onChangeText={setName} placeholder="Имя" autoCapitalize="words" />
      <Input
        value={username}
        onChangeText={setUsername}
        placeholder="Юзернейм"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <ErrorText>{error}</ErrorText>
      {saved && <Text style={{ color: colors.primary }}>Сохранено</Text>}
      <Button title="Сохранить" onPress={save} loading={loading} />

      <Text style={styles.section}>Контакты аккаунта</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Телефон</Text>
        <Text style={styles.value}>{session?.user.phone ? `+${session.user.phone}` : 'не указан'}</Text>
        <Text style={styles.label}>Электронная почта</Text>
        <Text style={styles.value}>{session?.user.email ?? 'не указана'}</Text>
      </View>

      <Text style={styles.section}>Аккаунт</Text>
      <Button title="Выйти" variant="secondary" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.muted, fontSize: 13, textTransform: 'uppercase', marginTop: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  label: { color: colors.muted, fontSize: 12, marginTop: 6 },
  value: { color: colors.text, fontSize: 16 },
});
