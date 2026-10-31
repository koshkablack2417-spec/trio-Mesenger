import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, ErrorText, Input, Screen } from '../components/ui';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

// Экран «Защити аккаунт».
// - Вошёл по e-mail: обязан добавить и подтвердить номер телефона, пропустить нельзя.
// - Вошёл по телефону: может добавить e-mail или нажать «Пропустить».
export default function Protect() {
  const { protect, skipProtect } = useAuth();
  const adding = protect.add ?? 'phone';
  const isPhone = adding === 'phone';

  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = isPhone ? value.replace(/[^\d+]/g, '') : value.trim();

  async function sendCode() {
    setError(null);
    if (isPhone && !/^\+\d{8,15}$/.test(normalized)) {
      return setError('Введи номер в формате +34600111222');
    }
    if (!isPhone && !/^\S+@\S+\.\S+$/.test(normalized)) {
      return setError('Введи корректный e-mail');
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser(
      isPhone ? { phone: normalized } : { email: normalized },
    );
    setLoading(false);
    if (err) return setError(err.message);
    setCodeSent(true);
  }

  async function verify() {
    setError(null);
    setLoading(true);
    const { error: err } = isPhone
      ? await supabase.auth.verifyOtp({ phone: normalized, token: code.trim(), type: 'phone_change' })
      : await supabase.auth.verifyOtp({ email: normalized, token: code.trim(), type: 'email_change' });
    if (err) {
      setLoading(false);
      return setError(err.message);
    }
    // Обновляем сессию: в ней теперь есть и телефон, и e-mail, и защита снимется.
    await supabase.auth.refreshSession();
    setLoading(false);
  }

  return (
    <Screen>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>
        Давай защитим твой аккаунт
      </Text>
      <Text style={{ color: colors.muted, fontSize: 16 }}>
        {isPhone
          ? 'Добавь номер телефона: так аккаунт можно будет восстановить, а друзья смогут найти тебя в Трио.'
          : 'Добавь адрес электронной почты, чтобы аккаунт можно было восстановить, если потеряешь телефон.'}
      </Text>

      {!codeSent ? (
        <>
          <Input
            value={value}
            onChangeText={setValue}
            placeholder={isPhone ? '+34 600 111 222' : 'you@example.com'}
            keyboardType={isPhone ? 'phone-pad' : 'email-address'}
            autoCapitalize="none"
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Получить код" onPress={sendCode} loading={loading} />
        </>
      ) : (
        <>
          <Text style={{ color: colors.muted }}>
            Код отправлен на {normalized}
          </Text>
          <Input
            value={code}
            onChangeText={setCode}
            placeholder="Код подтверждения"
            keyboardType="number-pad"
            maxLength={8}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Подтвердить" onPress={verify} loading={loading} />
          <Button
            title={isPhone ? 'Другой номер' : 'Другой e-mail'}
            variant="secondary"
            onPress={() => setCodeSent(false)}
          />
        </>
      )}

      {protect.canSkip && (
        <Button title="Пропустить" variant="secondary" onPress={() => void skipProtect()} />
      )}
    </Screen>
  );
}
