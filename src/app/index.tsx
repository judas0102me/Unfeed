// Pantalla de inicio provisional: se reemplaza por onboarding y limpieza en los siguientes pasos.
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { spacing, useColors } from '@/theme/colors';

export default function Home() {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.hero}>
        <Text style={[styles.title, { color: colors.text }]}>{t('home.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('home.subtitle')}</Text>
      </View>
      <View style={styles.actions}>
        <Button label={t('home.start')} onPress={() => {}} />
        {__DEV__ && <Button label={t('home.debug')} variant="secondary" onPress={() => router.push('/debug')} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  hero: { marginTop: spacing.xl * 2, gap: spacing.md },
  title: { fontSize: 34, fontWeight: '700' },
  subtitle: { fontSize: 17, lineHeight: 24 },
  actions: { gap: spacing.sm },
});
