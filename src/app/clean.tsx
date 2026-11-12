// Pantalla principal: cuenta, cupo del día y categorías a limpiar.
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CategoryToggle, Meter, Wordmark } from '@/components/brand';
import { Button } from '@/components/Button';
import { Body, Screen, TextLink } from '@/components/ui';
import { appStore } from '@/core/appStore';
import { DailyQuota, FREE_DAILY_LIMIT } from '@/core/limits/dailyQuota';
import { storage } from '@/core/storage';
import type { Category } from '@/platforms/types';
import { spacing, useColors } from '@/theme/colors';

const CATEGORIES: Category[] = ['reposts', 'likes', 'favorites'];

export default function Clean() {
  const { t } = useTranslation();
  const colors = useColors();
  const [account] = useState(appStore.account);
  const [selected, setSelected] = useState<Category[]>(CATEGORIES);
  const [remaining, setRemaining] = useState(() => new DailyQuota(storage).remaining());
  const [dryRun, setDryRun] = useState(appStore.dryRun);
  const [lastRun, setLastRun] = useState(appStore.lastRun);

  // Al volver de una limpieza o de ajustes se releen el cupo y el modo prueba.
  useFocusEffect(
    useCallback(() => {
      setRemaining(new DailyQuota(storage).remaining());
      setDryRun(appStore.dryRun());
      setLastRun(appStore.lastRun());
    }, []),
  );

  if (!account) return <Redirect href="/login" />;

  const toggle = (category: Category) =>
    setSelected(prev => (prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]));
  const ordered = CATEGORIES.filter(c => selected.includes(c));
  const start = () => router.push({ pathname: '/progress', params: { categories: ordered.join(',') } });
  const canStart = ordered.length > 0 && (remaining > 0 || dryRun);

  return (
    <Screen
      ad
      scroll
      footer={
        <>
          <Body strong>
            {remaining > 0
              ? t('clean.quota', { remaining, limit: FREE_DAILY_LIMIT })
              : t('clean.quotaEmpty', { limit: FREE_DAILY_LIMIT })}
          </Body>
          <Meter value={remaining} max={FREE_DAILY_LIMIT} />
          {dryRun && <Body style={{ color: colors.danger }}>{t('clean.dryRun')}</Body>}
          <Button label={t('clean.start')} onPress={start} disabled={!canStart} />
        </>
      }
    >
      <View style={styles.top}>
        <Wordmark />
        <TextLink label={t('clean.settings')} onPress={() => router.push('/settings')} />
      </View>
      <View>
        <Body muted>{t('clean.account', { handle: account.handle })}</Body>
        {lastRun && <Body muted>{t('clean.lastRun', { count: lastRun.totalRemoved })}</Body>}
      </View>

      <View style={styles.choose}>
        <Body strong>{t('clean.choose')}</Body>
        <Body muted>{t('clean.hint')}</Body>
      </View>
      <View>
        {CATEGORIES.map(category => (
          <CategoryToggle
            key={category}
            label={t(`categories.${category}`)}
            selected={selected.includes(category)}
            onPress={() => toggle(category)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  choose: { marginTop: spacing.md },
});
