// Inicio de sesión en TikTok dentro de un WebView. Se comprueba la sesión cada pocos
// segundos y, en cuanto está iniciada, se guarda la cuenta y se pasa a limpiar.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlatformWebView, usePlatform } from '@/components/PlatformWebView';
import { Body, Heading, TextLink } from '@/components/ui';
import { accountFromProfileUrl, appStore } from '@/core/appStore';
import { TIKTOK } from '@/platforms/tiktok/selectors';
import { spacing } from '@/theme/colors';

export default function Login() {
  const { t } = useTranslation();
  const { logout } = useLocalSearchParams<{ logout?: string }>();
  const { runner, adapter } = usePlatform();
  // Para cerrar sesión primero se carga TikTok, se llama al cierre y luego se muestra el login.
  const [loggingOut, setLoggingOut] = useState(logout === '1');
  const [uri, setUri] = useState(loggingOut ? adapter.homeUrl : adapter.loginUrl);

  useEffect(() => {
    if (loggingOut) return;
    const timer = setInterval(async () => {
      try {
        const session = await adapter.detectSession();
        if (session.loggedIn && session.profileUrl) {
          clearInterval(timer);
          appStore.setAccount(accountFromProfileUrl(session.profileUrl));
          router.replace('/clean');
        }
      } catch {
        // La página aún carga o está cambiando: se reintenta en el siguiente ciclo.
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [adapter, loggingOut]);

  const onLoadEnd = async () => {
    if (!loggingOut) return;
    try {
      await adapter.logout();
    } finally {
      appStore.clearAccount();
      setLoggingOut(false);
      setUri(adapter.loginUrl);
    }
  };

  const usingQr = uri === TIKTOK.qrLoginUrl;
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Heading>{t('login.title')}</Heading>
        <Body muted>{loggingOut ? t('login.loggingOut') : t('login.hint')}</Body>
        {!loggingOut && (
          <TextLink
            label={usingQr ? t('login.form') : t('login.qr')}
            onPress={() => setUri(usingQr ? adapter.loginUrl : TIKTOK.qrLoginUrl)}
          />
        )}
      </View>
      <PlatformWebView runner={runner} uri={uri} userAgent={adapter.userAgent} onLoadEnd={onLoadEnd} style={styles.web} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  web: { flex: 1 },
});
