// Mensajes que los scripts inyectados envían a la app vía window.ReactNativeWebView.postMessage.

export type BridgeMessage =
  | { type: 'log'; text: string }
  | { type: 'result'; id: string; ok: true; value: unknown }
  | { type: 'result'; id: string; ok: false; error: string };

export function parseBridgeMessage(raw: string): BridgeMessage | null {
  try {
    const msg = JSON.parse(raw);
    return msg && typeof msg.type === 'string' ? (msg as BridgeMessage) : null;
  } catch {
    return null;
  }
}

// Utilidades disponibles dentro de cada script inyectado como `U`.
// U.done(valor) y U.fail(error) responden a la app; cada script debe llamar a uno de los dos.
function prelude(id: string): string {
  return `
const U = {
  post(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); },
  log(text) { U.post({ type: 'log', text: String(text) }); },
  done(value) { U.post({ type: 'result', id: ${JSON.stringify(id)}, ok: true, value: value === undefined ? null : value }); },
  fail(error) { U.post({ type: 'result', id: ${JSON.stringify(id)}, ok: false, error: String(error) }); },
  find(selectors, root) {
    for (const s of selectors) {
      const el = (root || document).querySelector(s);
      if (el) return el;
    }
    return null;
  },
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
  async waitUntil(fn, timeout) {
    const end = Date.now() + (timeout || 8000);
    while (Date.now() < end) {
      const el = fn();
      if (el) return el;
      await U.sleep(250);
    }
    return null;
  },
  waitFor(selectors, timeout) { return U.waitUntil(() => U.find(selectors), timeout); },
  describe(el) {
    if (!el) return 'null';
    const e2e = el.getAttribute('data-e2e');
    const aria = el.getAttribute('aria-label') || el.getAttribute('aria-pressed');
    return el.tagName.toLowerCase() + (e2e ? '[e2e=' + e2e + ']' : '') + (aria ? ' aria=' + aria : '');
  },
};
`;
}

// Envuelve un cuerpo async para inyectarlo: captura errores y termina en `true;` como exige react-native-webview.
export function wrapScript(id: string, body: string): string {
  return `(async () => {
${prelude(id)}
try {
${body}
} catch (e) {
  U.fail('Error: ' + (e && e.message));
}
})();
true;`;
}

// Se inyecta antes de que cargue cada página. iOS abre en pantalla completa cualquier
// <video> sin `playsinline`, y la web de escritorio de TikTok no lo pone.
export const BEFORE_LOAD = `
(() => {
  const inline = v => { v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); };
  new MutationObserver(() => document.querySelectorAll('video:not([playsinline])').forEach(inline))
    .observe(document, { childList: true, subtree: true });
  const noop = () => Promise.resolve();
  HTMLVideoElement.prototype.webkitEnterFullscreen = noop;
  Element.prototype.requestFullscreen = noop;
})();
true;
`;
