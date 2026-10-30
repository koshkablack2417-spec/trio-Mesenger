import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, ErrorText, Input, Screen } from '../../components/ui';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

export default function EmailLogin() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setError(null);
    if (!isSupabaseConfigured) return setError('Supabase не настроен: заполни .env');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Введи корректный e-mail');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setLoading(false);
    if (err) return setError(err.message);
    setCodeSent(true);
  }

  async function verify() {
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setLoading(false);
    if (err) setError(err.message);
  }

  return (
    <Screen>
      {!codeSent ? (
        <>
          <Text style={{ color: colors.muted }}>Мы отправим код на почту.</Text>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Получить код" onPress={sendCode} loading={loading} />
        </>
      ) : (
        <>
          <Text style={{ color: colors.muted }}>Код отправлен на {email.trim()}</Text>
          <Input
            value={code}
            onChangeText={setCode}
            placeholder="Код из письма"
            keyboardType="number-pad"
            maxLength={8}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Войти" onPress={verify} loading={loading} />
          <Button title="Другой e-mail" variant="secondary" onPress={() => setCodeSent(false)} />
        </>
      )}
    </Screen>
  );
}
