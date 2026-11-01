import { Stack } from 'expo-router';
import React from 'react';
import { colors } from '../../lib/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Трио' }} />
      <Stack.Screen name="new-chat" options={{ title: 'Новый чат', presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ title: 'Настройки' }} />
      <Stack.Screen name="chat/[id]" options={{ title: 'Чат' }} />
    </Stack>
  );
}
