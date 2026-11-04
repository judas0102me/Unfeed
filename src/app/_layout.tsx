import '@/i18n';

import { BigShoulders_900Black } from '@expo-google-fonts/big-shoulders';
import { InstrumentSans_400Regular, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { initAds } from '@/core/ads';
import { refreshRemoteConfig } from '@/core/config/remoteConfig';
import { storage } from '@/core/storage';
import { useColors } from '@/theme/colors';

export default function RootLayout() {
  const colors = useColors();
  const scheme = useColorScheme();
  const [fontsLoaded] = useFonts({ BigShoulders_900Black, InstrumentSans_400Regular, InstrumentSans_600SemiBold });
  // Sin esperar: si hay selectores nuevos, se usan en la próxima limpieza.
  useEffect(() => {
    refreshRemoteConfig(storage);
    initAds();
  }, []);
  if (!fontsLoaded) return null;
  return (
    <>
      {/* "auto" no cambia si el tema del teléfono cambia con la app abierta. */}
      <StatusBar key={scheme} style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {/* Volver atrás con el gesto detendría la limpieza: se usa el botón Detener. */}
        <Stack.Screen name="progress" options={{ gestureEnabled: false }} />
        <Stack.Screen name="summary" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
