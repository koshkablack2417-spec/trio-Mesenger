import { Stack } from 'expo-router';
import React from 'react';
import { colors } from '../../lib/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="phone" options={{ title: 'Номер телефона' }} />
      <Stack.Screen name="email" options={{ title: 'E-mail' }} />
      <Stack.Screen name="qr" options={{ title: 'Вход по QR-коду' }} />
    </Stack>
  );
}
