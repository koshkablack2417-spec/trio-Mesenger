import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/ui';
import { colors } from '../../lib/theme';

// Заглушка. Следующий шаг: Edge Function создаёт qr_sessions, здесь рисуется QR-код,
// телефон сканирует его и подтверждает вход (как WhatsApp Web).
export default function QrLogin() {
  return (
    <Screen>
      <Text style={styles.title}>Трио</Text>
      <Text style={styles.text}>
        Вход на iPad и компьютере только по QR-коду. Открой Трио на телефоне, затем
        «Настройки → Устройства → Подключить устройство» и отсканируй код.
      </Text>
      <View style={styles.box}>
        <Text style={{ color: colors.muted }}>QR-код появится здесь (скоро)</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 36, fontWeight: '800', textAlign: 'center' },
  text: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  box: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
