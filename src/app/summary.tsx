import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Body, Card, Heading, Screen } from '@/components/ui';
import { appStore } from '@/core/appStore';
import type { StopReason } from '@/core/engine/engine';
import { DailyQuota, FREE_DAILY_LIMIT } from '@/core/limits/dailyQuota';
import { storage } from '@/core/storage';
import type { Category } from '@/platforms/types';
import { useColors } from '@/theme/colors';

const CATEGORIES: Category[] = ['reposts', 'likes', 'favorites'];

function messageKey(reason: StopReason | null): string {
  if (!reason) return 'summary.stopped';
  if (reason.kind === 'blocked') return `summary.${reason.reason}`;
  return `summary.${reason.kind}`;
}

export default function Summary() {
  const { t } = useTranslation();
  const colors = useColors();
  const [run] = useState(appStore.lastRun);
  const [remaining] = useState(() => new DailyQuota(storage).remaining());
  const reason = run?.stopReason ?? null;
  const needsLogin = reason?.kind === 'blocked' && reason.reason === 'logged_out';

  const footer = needsLogin ? (
    <Button label={t('summary.login')} onPress={() => router.replace('/login')} />
  ) : (
    <Button label={t('summary.home')} onPress={() => router.replace('/clean')} />
  );

  return (
    <Screen scroll footer={footer}>
      <Heading>{t(messageKey(reason), { message: reason?.kind === 'error' ? reason.message : '' })}</Heading>
      <View style={styles.total}>
        <Text style={[styles.totalNumber, { color: colors.accent }]}>{run?.totalRemoved ?? 0}</Text>
        <Body muted>{t('summary.total')}</Body>
      </View>
      {run && (
        <Card>
          {CATEGORIES.filter(c => run.stats[c].removed + run.stats[c].skipped + run.stats[c].failed > 0).map(category => (
            <View key={category} style={styles.row}>
              <Body>{t(`categories.${category}`)}</Body>
              <Body muted>{t('progress.row', run.stats[category])}</Body>
            </View>
          ))}
          <Body muted>{t('clean.quota', { remaining, limit: FREE_DAILY_LIMIT })}</Body>
        </Card>
      )}
      {run?.dryRun && <Body style={{ color: colors.danger }}>{t('summary.dryRun')}</Body>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { alignItems: 'center' },
  totalNumber: { fontSize: 56, fontWeight: '800', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
