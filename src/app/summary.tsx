import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CategoryWord, Count } from '@/components/brand';
import { Button } from '@/components/Button';
import { Body, Heading, Screen } from '@/components/ui';
import { appStore } from '@/core/appStore';
import type { StopReason } from '@/core/engine/engine';
import { DailyQuota, FREE_DAILY_LIMIT } from '@/core/limits/dailyQuota';
import { storage } from '@/core/storage';
import type { Category } from '@/platforms/types';
import { spacing, useColors } from '@/theme/colors';

const CATEGORIES: Category[] = ['reposts', 'likes', 'favorites'];

function messageKey(reason: StopReason | null, failed: number): string {
  if (!reason) return 'summary.stopped';
  if (reason.kind === 'completed' && failed > 0) return 'summary.completedWithFailures';
  if (reason.kind === 'blocked') return `summary.${reason.reason}`;
  return `summary.${reason.kind}`;
}

export default function Summary() {
  const { t } = useTranslation();
  const colors = useColors();
  const [run] = useState(appStore.lastRun);
  const [remaining] = useState(() => new DailyQuota(storage).remaining());
  const reason = run?.stopReason ?? null;
  const failed = run ? CATEGORIES.reduce((sum, c) => sum + run.stats[c].failed, 0) : 0;
  const needsLogin = reason?.kind === 'blocked' && reason.reason === 'logged_out';

  const footer = needsLogin ? (
    <Button label={t('summary.login')} onPress={() => router.replace('/login')} />
  ) : (
    <Button label={t('summary.home')} onPress={() => router.replace('/clean')} />
  );

  return (
    <Screen scroll ad footer={footer}>
      <Heading>{t(messageKey(reason, failed), { count: failed })}</Heading>
      {failed > 0 && <Body muted>{t('summary.failedHint')}</Body>}
      {reason?.kind === 'error' && <Body muted>{__DEV__ ? reason.message : t('summary.errorHint')}</Body>}
      <Count value={run?.totalRemoved ?? 0} label={t('summary.total', { count: run?.totalRemoved ?? 0 })} />
      {run && (
        <View>
          {CATEGORIES.filter(c => run.stats[c].removed + run.stats[c].skipped + run.stats[c].failed > 0).map(category => (
            <View key={category} style={styles.row}>
              <CategoryWord label={t(`categories.${category}`)} size={36} struck={run.stats[category].failed === 0} />
              <Body muted style={styles.stat}>
                {t(run.stats[category].failed ? 'summary.rowFailed' : 'progress.row', { ...run.stats[category], count: run.stats[category].removed })}
              </Body>
            </View>
          ))}
        </View>
      )}
      <Body muted>{t('clean.quota', { remaining, limit: FREE_DAILY_LIMIT })}</Body>
      {run?.dryRun && <Body style={{ color: colors.danger }}>{t('summary.dryRun')}</Body>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  stat: { flexShrink: 1, textAlign: 'right', fontSize: 13, lineHeight: 18 },
});
