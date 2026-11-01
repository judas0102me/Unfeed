// Limpieza en curso: el WebView de TikTok queda visible en pequeño mientras el motor trabaja.
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { PlatformWebView, usePlatform } from '@/components/PlatformWebView';
import { Body, Card, Heading, Screen } from '@/components/ui';
import { appStore, paceFor } from '@/core/appStore';
import { CleaningEngine, EngineState } from '@/core/engine/engine';
import { ProgressStore } from '@/core/engine/progress';
import { DailyQuota } from '@/core/limits/dailyQuota';
import { storage } from '@/core/storage';
import type { Category } from '@/platforms/types';
import { radius, useColors } from '@/theme/colors';

const CATEGORIES: Category[] = ['reposts', 'likes', 'favorites'];

export default function Progress() {
  useKeepAwake();
  const { t } = useTranslation();
  const colors = useColors();
  const params = useLocalSearchParams<{ categories?: string }>();
  const [categories] = useState(() =>
    CATEGORIES.filter(c => (params.categories ?? '').split(',').includes(c)),
  );
  const { runner, adapter } = usePlatform();
  const [quota] = useState(() => new DailyQuota(storage));
  const [dryRun] = useState(appStore.dryRun);
  const [engine] = useState(
    () =>
      new CleaningEngine(adapter, quota, {
        dryRun,
        progress: new ProgressStore(storage, adapter.id),
        ...paceFor(appStore.speed()),
      }),
  );
  const [state, setState] = useState<EngineState>(engine.getState());
  const started = useRef(false);

  useEffect(() => {
    const unsubscribe = engine.subscribe(setState);
    // Al salir de la pantalla la limpieza se detiene.
    return () => {
      unsubscribe();
      engine.stop();
    };
  }, [engine]);

  // Arranca con la primera carga de TikTok, tras comprobar que hay sesión.
  const start = async () => {
    if (started.current) return;
    started.current = true;
    let loggedIn = false;
    for (let attempt = 0; attempt < 5 && !loggedIn; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      loggedIn = await adapter.detectSession().then(s => s.loggedIn, () => false);
    }
    if (!loggedIn) {
      appStore.clearAccount();
      router.replace('/login');
      return;
    }
    const final = await engine.run(categories);
    appStore.setLastRun({
      stats: final.stats,
      totalRemoved: final.totalRemoved,
      stopReason: final.stopReason,
      finishedAt: Date.now(),
      dryRun,
    });
    router.replace('/summary');
  };

  const title =
    state.status === 'paused'
      ? t('progress.paused')
      : state.status === 'resting'
        ? t('progress.resting')
        : state.category
          ? t('progress.running', { category: t(`categories.${state.category}`) })
          : t('progress.preparing');
  const isPaused = state.status === 'paused';

  return (
    <Screen
      footer={
        <>
          <Button
            label={isPaused ? t('progress.resume') : t('progress.pause')}
            variant="secondary"
            disabled={state.status === 'idle'}
            onPress={() => (isPaused ? engine.resume() : engine.pause())}
          />
          <Button label={t('progress.stop')} variant="danger" onPress={() => engine.stop()} />
        </>
      }
    >
      <Heading style={styles.title}>{title}</Heading>
      <View style={styles.total}>
        <Text style={[styles.totalNumber, { color: colors.accent }]}>{state.totalRemoved}</Text>
        <Body muted>{t('progress.removed')}</Body>
      </View>

      <Card>
        {categories.map(category => (
          <View key={category} style={styles.row}>
            <Body style={{ fontWeight: state.category === category ? '700' : '400' }}>{t(`categories.${category}`)}</Body>
            <Body muted>{t('progress.row', state.stats[category])}</Body>
          </View>
        ))}
        {!dryRun && <Body muted>{t('progress.quota', { remaining: quota.remaining() })}</Body>}
      </Card>

      {/* El usuario ve lo que pasa, pero no puede tocar la página mientras se limpia. */}
      <View style={[styles.webBox, { borderColor: colors.border }]} pointerEvents="none">
        <PlatformWebView runner={runner} uri={adapter.homeUrl} userAgent={adapter.userAgent} onLoadEnd={start} style={styles.web} />
      </View>
      <Body muted style={styles.center}>
        {t('progress.keepOpen')}
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22 },
  total: { alignItems: 'center' },
  totalNumber: { fontSize: 56, fontWeight: '800', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  webBox: { flex: 1, minHeight: 180, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  web: { flex: 1 },
  center: { textAlign: 'center' },
});
