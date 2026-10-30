import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Screen } from '../../components/ui';
import { colors } from '../../lib/theme';

// iPad и компьютер (веб) входят только по QR-коду. Телефон вводит номер.
const isBigScreenDevice = Platform.OS === 'web' || (Platform.OS === 'ios' && Platform.isPad);

export default function Welcome() {
  const router = useRouter();

  if (isBigScreenDevice) return <Redirect href="/(auth)/qr" />;

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.logo}>Трио</Text>
        <Text style={styles.subtitle}>Мессенджер для звонков</Text>
      </View>
      <Button title="Войти по номеру телефона" onPress={() => router.push('/(auth)/phone')} />
      <Button
        title="Войти по e-mail"
        variant="secondary"
        onPress={() => router.push('/(auth)/email')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 32, gap: 8 },
  logo: { color: colors.text, fontSize: 48, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 18 },
});
