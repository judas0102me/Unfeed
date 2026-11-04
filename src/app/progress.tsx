// Limpieza en curso: el WebView de TikTok queda visible en pequeño mientras el motor trabaja.
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CategoryWord, Count } from '@/components/brand';
import { Button } from '@/components/Button';
import { PlatformWebView, usePlatform } from '@/components/PlatformWebView';
import { Body, Heading, Screen } from '@/components/ui';
import { appStore, paceFor } from '@/core/appStore';
import { CleaningEngine, EngineState } from '@/core/engine/engine';
import { ProgressStore } from '@/core/engine/progress';
import { DailyQuota } from '@/core/limits/dailyQuota';
import { storage } from '@/core/storage';
import type { Category } from '@/platforms/types';
import { radius, spacing, useColors } from '@/theme/colors';

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
  const current = state.category ? categories.indexOf(state.category) : -1;

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button
              label={isPaused ? t('progress.resume') : t('progress.pause')}
              variant="secondary"
              disabled={state.status === 'idle'}
              onPress={() => (isPaused ? engine.resume() : engine.pause())}
            />
          </View>
          <View style={styles.action}>
            <Button label={t('progress.stop')} variant="danger" onPress={() => engine.stop()} />
          </View>
        </View>
      }
    >
      <Heading style={styles.title}>{title}</Heading>
      <Count value={state.totalRemoved} label={t('progress.removed', { count: state.totalRemoved })} />

      <View>
        {categories.map((category, index) => (
          <View key={category} style={styles.row}>
            <CategoryWord label={t(`categories.${category}`)} size={36} struck={index < current} dim={index > current} />
            <Body muted style={styles.stat}>
              {t('progress.row', { ...state.stats[category], count: state.stats[category].removed })}
            </Body>
          </View>
        ))}
      </View>
      {!dryRun && <Body muted>{t('progress.quota', { remaining: quota.remaining() })}</Body>}

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
  title: { fontSize: 32, lineHeight: 36 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  stat: { flexShrink: 1, textAlign: 'right', fontSize: 13, lineHeight: 18 },
  webBox: { flex: 1, minHeight: 140, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  web: { flex: 1 },
  center: { textAlign: 'center' },
});
