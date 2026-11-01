// Panel de la fase 0: prueba manual de los scripts de TikTok. Solo disponible en desarrollo.
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { BEFORE_LOAD, parseBridgeMessage } from '@/core/bridge';
import * as tiktok from '@/platforms/tiktok/scripts';
import { Category, TIKTOK } from '@/platforms/tiktok/selectors';

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'reposts', label: 'Reposts' },
  { key: 'likes', label: 'Likes' },
  { key: 'favorites', label: 'Favoritos' },
];

export default function DebugRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DebugScreen />;
}

function DebugScreen() {
  // WebView<P = undefined> se vuelve `never` con TS 6; se fija P = object explícitamente.
  const webview = useRef<WebView<object>>(null);
  const [url, setUrl] = useState<string>(TIKTOK.homeUrl);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);

  const log = useCallback((line: string) => {
    console.log('[unfeed]', line);
    // Solo en desarrollo: copia del log a un colector local para leerlo fuera del simulador.
    if (__DEV__) fetch('http://127.0.0.1:8099', { method: 'POST', body: line }).catch(() => {});
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`${time}  ${line}`, ...prev].slice(0, 200));
  }, []);

  const run = (script: string) => webview.current?.injectJavaScript(script);
  const go = (target: string) => setUrl(target + (target.includes('?') ? '&' : '?') + '_=' + Date.now());

  const onMessage = (event: WebViewMessageEvent) => {
    const msg = parseBridgeMessage(event.nativeEvent.data);
    if (!msg) return;
    switch (msg.type) {
      case 'log':
        log(msg.text);
        break;
      case 'session':
        setProfileUrl(msg.profileUrl);
        log(`Sesión: ${msg.loggedIn ? 'iniciada' : 'no iniciada'} · perfil: ${msg.profileUrl ?? '—'}`);
        break;
      case 'inspect': {
        const keys = Object.entries(msg.e2e)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, n]) => `${k}×${n}`);
        log(`Página ${msg.url}\ntítulo: ${msg.title} · texto: ${msg.textLength} caracteres\ndata-e2e: ${keys.join(', ') || '(ninguno)'}`);
        if (keys.length === 0) log(`HTML: ${msg.snippet}`);
        log(`Botones: ${msg.labels.join(' | ')}`);
        break;
      }
      case 'result':
        log(`${msg.ok ? '✅' : '❌'} ${msg.action}: ${msg.detail}`);
        break;
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <WebView<object>
        ref={webview}
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
          <Btn label="Sesión" onPress={() => run(tiktok.detectSession())} />
          <Btn label="Mi perfil" disabled={!profileUrl} onPress={() => run(tiktok.goToProfile())} />
          <Btn label="Inspeccionar" onPress={() => run(tiktok.inspectPage())} />
        </View>

        {CATEGORIES.map(c => (
          <View key={c.key} style={styles.row}>
            <Text style={styles.cat}>{c.label}</Text>
            <Btn label="Abrir pestaña" onPress={() => run(tiktok.openTab(c.key))} />
            <Btn label="Eliminar 1" danger={!dryRun} onPress={() => run(tiktok.removeOne(c.key, dryRun))} />
          </View>
        ))}

        <View style={styles.row}>
          <Btn
            label={dryRun ? 'Modo prueba: SÍ (sin clic final)' : 'Modo prueba: NO (elimina de verdad)'}
            danger={!dryRun}
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
