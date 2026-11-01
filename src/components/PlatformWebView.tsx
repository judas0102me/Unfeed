// WebView de TikTok con lo que necesitan los scripts: user agent de escritorio, sesión
// compartida, videos sin pantalla completa y el puente de mensajes con ScriptRunner.
import { useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { BEFORE_LOAD, parseBridgeMessage } from '@/core/bridge';
import { ScriptRunner } from '@/core/runner';
import { createTikTokAdapter } from '@/platforms/tiktok/adapter';

export function usePlatform() {
  const [runner] = useState(() => new ScriptRunner());
  const [adapter] = useState(() => createTikTokAdapter(runner));
  return { runner, adapter };
}

export function PlatformWebView({
  runner,
  uri,
  userAgent,
  onLoadEnd,
  style,
}: {
  runner: ScriptRunner;
  uri: string;
  userAgent: string;
  onLoadEnd?: (url: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const onMessage = (event: WebViewMessageEvent) => {
    const msg = parseBridgeMessage(event.nativeEvent.data);
    if (!msg) return;
    if (msg.type === 'log') {
      if (__DEV__) console.log('[unfeed]', msg.text);
    } else runner.handle(msg);
  };

  return (
    // WebView<P = undefined> se vuelve `never` con TS 6; se fija P = object explícitamente.
    <WebView<object>
      ref={view => runner.attach(view)}
      style={style}
      source={{ uri }}
      userAgent={userAgent}
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      setSupportMultipleWindows={false}
      allowsInlineMediaPlayback
      // Sin reproducción automática: evita sonido y datos mientras se limpia.
      mediaPlaybackRequiresUserAction
      injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD}
      allowsFullscreenVideo={false}
      onMessage={onMessage}
      onLoadEnd={e => onLoadEnd?.(e.nativeEvent.url)}
    />
  );
}
