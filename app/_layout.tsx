import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { subscribeToIncoming } from '../lib/calls';
import { colors } from '../lib/theme';

// WebRTC для звонков: есть только в собранном приложении, в Expo Go пропускаем
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@livekit/react-native') as { registerGlobals: () => void }).registerGlobals();
} catch {
  /* нет нативного модуля */
}

function Gate() {
  const { session, loading, protect } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0] as string | undefined;
    const inAuth = first === '(auth)';
    const inProtect = first === 'protect';

    if (!session) {
      if (!inAuth) router.replace('/(auth)/welcome');
      return;
    }
    if (protect.needsProtect) {
      if (!inProtect) router.replace('/protect');
      return;
    }
    if (inAuth || inProtect) router.replace('/(app)');
  }, [session, loading, protect.needsProtect, segments, router]);

  const me = session?.user.id;
  useEffect(() => {
    if (!me) return;
    return subscribeToIncoming(me, (c) =>
      router.push({ pathname: '/call/[id]', params: { id: c.id } }),
    );
  }, [me, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen name="call/[id]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen
        name="protect"
        options={{ title: 'Защита аккаунта', headerBackVisible: false, gestureEnabled: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
