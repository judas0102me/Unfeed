import '@/i18n';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { refreshRemoteConfig } from '@/core/config/remoteConfig';
import { storage } from '@/core/storage';
import { useColors } from '@/theme/colors';

export default function RootLayout() {
  const colors = useColors();
  // Sin esperar: si hay selectores nuevos, se usan en la próxima limpieza.
  useEffect(() => {
    refreshRemoteConfig(storage);
  }, []);
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}
