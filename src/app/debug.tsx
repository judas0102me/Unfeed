// Panel de la fase 0: prueba manual del adaptador de TikTok. Solo disponible en desarrollo.
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { BEFORE_LOAD, parseBridgeMessage } from '@/core/bridge';
import { ScriptRunner } from '@/core/runner';
import { createTikTokAdapter } from '@/platforms/tiktok/adapter';
import { inspectPage } from '@/platforms/tiktok/scripts';
import { TIKTOK } from '@/platforms/tiktok/selectors';
import type { Category, RemoveResult } from '@/platforms/types';

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'reposts', label: 'Reposts' },
  { key: 'likes', label: 'Likes' },
  { key: 'favorites', label: 'Favoritos' },
];

type Inspection = { url: string; title: string; textLength: number; snippet: string; e2e: Record<string, number>; labels: string[] };

function describeResult(r: RemoveResult): string {
  switch (r.outcome) {
    case 'removed':
      return r.simulated ? `modo prueba, botón activo en ${r.href}` : `eliminado ${r.href}`;
    case 'inactive':
      return `ya inactivo ${r.href}`;
    case 'not_found':
      return 'no hay más elementos visibles';
    case 'blocked':
      return `BLOQUEO: ${r.reason}`;
    case 'failed':
      return `falló: ${r.detail}`;
  }
}

export default function DebugRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DebugScreen />;
}

function DebugScreen() {
  const [url, setUrl] = useState<string>(TIKTOK.homeUrl);
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);

  // Se crean una sola vez; el WebView se conecta al runner con su ref.
  const [runner] = useState(() => new ScriptRunner());
  const [adapter] = useState(() => createTikTokAdapter(runner));

  const log = (line: string) => {
    console.log('[unfeed]', line);
    // Solo en desarrollo: copia del log a un colector local para leerlo fuera del simulador.
    if (__DEV__) fetch('http://127.0.0.1:8099', { method: 'POST', body: line }).catch(() => {});
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`${time}  ${line}`, ...prev].slice(0, 200));
  };

  const go = (target: string) => setUrl(target + (target.includes('?') ? '&' : '?') + '_=' + Date.now());

  // Ejecuta una acción del adaptador, de una en una, y registra el resultado.
  const call = async <T,>(label: string, fn: () => Promise<T>, show: (value: T) => string) => {
    if (busy) return;
    setBusy(true);
    try {
      log(`✅ ${label}: ${show(await fn())}`);
    } catch (e) {
      log(`❌ ${label}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // Recorre la pestaña desde el principio saltando los ya inactivos, como hará el motor.
  const removeNext = async (category: Category) => {
    for (let index = 0; ; index++) {
      const result = await adapter.removeItem(category, index, { dryRun });
      if (result.outcome !== 'inactive') return `#${index} ${describeResult(result)}`;
      log(`#${index} ${describeResult(result)}, sigo`);
    }
  };

  const onMessage = (event: WebViewMessageEvent) => {
    const msg = parseBridgeMessage(event.nativeEvent.data);
    if (!msg) return;
    if (msg.type === 'log') log(msg.text);
    else runner.handle(msg);
  };

  const showInspection = (i: Inspection) => {
    const keys = Object.entries(i.e2e)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, n]) => `${k}×${n}`);
    if (keys.length === 0) log(`HTML: ${i.snippet}`);
    log(`Botones: ${i.labels.join(' | ')}`);
    return `${i.url}\ntítulo: ${i.title} · texto: ${i.textLength} caracteres\ndata-e2e: ${keys.join(', ') || '(ninguno)'}`;
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {/* WebView<P = undefined> se vuelve `never` con TS 6; se fija P = object explícitamente. */}
      <WebView<object>
        ref={view => runner.attach(view)}
        style={styles.web}
        source={{ uri: url }}
        userAgent={TIKTOK.userAgent}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        // Sin esto iOS abre cada video de TikTok en su reproductor a pantalla completa.
        allowsInlineMediaPlayback
        injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD}
        allowsFullscreenVideo={false}
        onMessage={onMessage}
        onLoadEnd={e => log(`Cargado: ${e.nativeEvent.url}`)}
      />

      {!panelOpen && (
        <View style={styles.floating}>
          <Btn label="Mostrar panel" onPress={() => setPanelOpen(true)} />
        </View>
      )}

      <View style={[styles.panel, !panelOpen && styles.hidden]}>
        <View style={styles.row}>
          <Btn label="Ocultar" onPress={() => setPanelOpen(false)} />
          <Btn label="Login" onPress={() => go(TIKTOK.loginUrl)} />
          <Btn label="QR" onPress={() => go(TIKTOK.qrLoginUrl)} />
          <Btn label="Inicio" onPress={() => go(TIKTOK.homeUrl)} />
          <Btn
            label="Sesión"
            disabled={busy}
            onPress={() =>
              call('Sesión', adapter.detectSession, s => `${s.loggedIn ? 'iniciada' : 'no iniciada'} · perfil: ${s.profileUrl ?? '—'}`)
            }
          />
          <Btn label="Bloqueo" disabled={busy} onPress={() => call('Bloqueo', adapter.detectBlock, b => b ?? 'ninguno')} />
          <Btn label="Inspeccionar" disabled={busy} onPress={() => call('Página', () => runner.run<Inspection>(inspectPage()), showInspection)} />
        </View>

        {CATEGORIES.map(c => (
          <View key={c.key} style={styles.row}>
            <Text style={styles.cat}>{c.label}</Text>
            <Btn
              label="Abrir"
              disabled={busy}
              onPress={() => call(`Abrir ${c.label}`, () => adapter.openCategory(c.key), n => `${n} visibles`)}
            />
            <Btn label="Más" disabled={busy} onPress={() => call('Cargar más', adapter.loadMore, n => `${n} visibles`)} />
            <Btn
              label="Eliminar siguiente"
              disabled={busy}
              danger={!dryRun}
              onPress={() => call(`Eliminar ${c.label}`, () => removeNext(c.key), r => r)}
            />
          </View>
        ))}

        <View style={styles.row}>
          <Btn
            label={dryRun ? 'Modo prueba: SÍ (sin clic final)' : 'Modo prueba: NO (elimina de verdad)'}
            danger={!dryRun}
            disabled={busy}
            onPress={() => setDryRun(v => !v)}
          />
          <Btn label="Limpiar log" onPress={() => setLogs([])} />
        </View>

        <ScrollView style={styles.log}>
          {logs.map((l, i) => (
            <Text key={i} style={styles.logLine} selectable>
              {l}
            </Text>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Btn({ label, onPress, disabled, danger }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btn, danger && styles.btnDanger, (pressed || disabled) && styles.btnDim]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  web: { flex: 1 },
  hidden: { display: 'none' },
  floating: { position: 'absolute', right: 12, bottom: 40 },
  panel: { height: '45%', borderTopWidth: 1, borderColor: '#ddd', padding: 8, gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  cat: { fontWeight: '600', minWidth: 72 },
  btn: { backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  btnDanger: { backgroundColor: '#c62828' },
  btnDim: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 13 },
  log: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 6, padding: 6 },
  logLine: { fontFamily: 'Courier', fontSize: 11, marginBottom: 4 },
});
