import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, ErrorText, Input, Screen } from '../../components/ui';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

export default function PhoneLogin() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Номер в международном формате, например +34600111222
  const normalized = phone.replace(/[^\d+]/g, '');

  async function sendCode() {
    setError(null);
    if (!isSupabaseConfigured) return setError('Supabase не настроен: заполни .env');
    if (!/^\+\d{8,15}$/.test(normalized)) {
      return setError('Введи номер в формате +34600111222');
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: normalized });
    setLoading(false);
    if (err) return setError(err.message);
    setCodeSent(true);
  }

  async function verify() {
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: code.trim(),
      type: 'sms',
    });
    setLoading(false);
    if (err) setError(err.message);
    // При успехе AuthProvider сам перекинет в приложение.
  }

  return (
    <Screen>
      {!codeSent ? (
        <>
          <Text style={{ color: colors.muted }}>Мы отправим SMS с кодом подтверждения.</Text>
          <Input
            value={phone}
            onChangeText={setPhone}
            placeholder="+34 600 111 222"
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Получить код" onPress={sendCode} loading={loading} />
        </>
      ) : (
        <>
          <Text style={{ color: colors.muted }}>Код отправлен на {normalized}</Text>
          <Input
            value={code}
            onChangeText={setCode}
            placeholder="Код из SMS"
            keyboardType="number-pad"
            autoComplete="sms-otp"
            maxLength={8}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Войти" onPress={verify} loading={loading} />
          <Button title="Другой номер" variant="secondary" onPress={() => setCodeSent(false)} />
        </>
      )}
    </Screen>
  );
}
