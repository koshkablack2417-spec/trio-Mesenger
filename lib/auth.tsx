import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { type Profile, getProfile } from './profile';
import { supabase } from './supabase';

// Если false, e-mail-пользователям тоже показывается кнопка «Пропустить»
// (нужно, пока не подключён SMS-провайдер и телефон подтвердить нельзя).
const REQUIRE_PHONE_FOR_EMAIL_USERS = process.env.EXPO_PUBLIC_REQUIRE_PHONE_FOR_EMAIL_USERS !== 'false';

export type ProtectState = {
  /** Нужно показать экран «Защити аккаунт» */
  needsProtect: boolean;
  /** Что добавляем: телефон (для e-mail-аккаунта) или e-mail (для телефонного) */
  add: 'phone' | 'email' | null;
  /** Можно ли пропустить */
  canSkip: boolean;
};

type AuthState = {
  session: Session | null;
  loading: boolean;
  protect: ProtectState;
  /** Профиль загружен, но имя или юзернейм ещё не заданы */
  needsSetup: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  skipProtect: () => Promise<void>;
};

const NO_PROTECT: ProtectState = { needsProtect: false, add: null, canSkip: false };

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  protect: NO_PROTECT,
  needsSetup: false,
  profile: null,
  refreshProfile: async () => {},
  skipProtect: async () => {},
});

const skipKey = (userId: string) => `trio.protect_skipped.${userId}`;

function computeProtect(session: Session | null, skipped: boolean): ProtectState {
  const user = session?.user;
  if (!user) return NO_PROTECT;
  const hasEmail = !!user.email;
  const hasPhone = !!user.phone;
  if (hasEmail && hasPhone) return NO_PROTECT;

  if (hasEmail && !hasPhone) {
    // Зарегистрировался по e-mail: телефон обязателен, пропустить нельзя.
    const canSkip = !REQUIRE_PHONE_FOR_EMAIL_USERS;
    return { needsProtect: !(canSkip && skipped), add: 'phone', canSkip };
  }
  // Зарегистрировался по телефону: e-mail по желанию.
  return { needsProtect: !skipped, add: 'email', canSkip: true };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [skipped, setSkipped] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const userId = session?.user.id;

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setProfileLoaded(false);
      return;
    }
    try {
      setProfile(await getProfile(userId));
    } catch {
      setProfile(null);
    }
    setProfileLoaded(true);
  }, [userId]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const loadSkipped = useCallback(async (s: Session | null) => {
    if (!s) return setSkipped(false);
    try {
      setSkipped((await AsyncStorage.getItem(skipKey(s.user.id))) === '1');
    } catch {
      setSkipped(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadSkipped(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void loadSkipped(next);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadSkipped]);

  const skipProtect = useCallback(async () => {
    if (!session) return;
    try {
      await AsyncStorage.setItem(skipKey(session.user.id), '1');
    } catch {
      // не страшно: просто спросим снова при следующем входе
    }
    setSkipped(true);
  }, [session]);

  const protect = computeProtect(session, skipped);
  const needsSetup = !!session && profileLoaded && !profile?.username;

  return (
    <AuthContext.Provider value={{ session, loading, protect, needsSetup, profile, refreshProfile, skipProtect }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
