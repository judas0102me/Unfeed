import type { KeyValueStore } from '../storage';

// Configuración remota: un JSON con selectores por plataforma que permite corregir la app
// cuando una red cambia su web, sin esperar a que las tiendas aprueben una versión nueva.
//
// Formato: { "version": 2, "tiktok": { "gridItem": [...], "rateLimitText": { "source": "...", "flags": "i" } } }
//
// Pendiente: no hay dominio todavía (fase 2). Mientras sea null se usan los selectores de la app.
export const CONFIG_URL: string | null = null;

// Versión de los selectores que trae la app. Una configuración remota con versión menor o igual
// se ignora: así una versión nueva de la app no queda pisada por una configuración vieja.
export const BUNDLED_CONFIG_VERSION = 1;

const KEY = 'remote-config';
const REFRESH_EVERY_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 10000;

type Saved = { version: number; fetchedAt: number; data: Record<string, unknown> };

function readSaved(store: KeyValueStore): Saved | null {
  try {
    const saved = JSON.parse(store.getItem(KEY) ?? 'null');
    return saved && typeof saved.version === 'number' && saved.data && typeof saved.data === 'object' ? saved : null;
  } catch {
    return null;
  }
}

// Sección guardada de una plataforma (p. ej. "tiktok"), o null si no hay una más nueva que la de la app.
export function cachedPlatformConfig(store: KeyValueStore, platformId: string): unknown {
  const saved = readSaved(store);
  if (!saved || saved.version <= BUNDLED_CONFIG_VERSION) return null;
  return saved.data[platformId] ?? null;
}

export type RefreshResult = 'disabled' | 'fresh' | 'updated' | 'unchanged' | 'failed';

// Descarga la configuración si pasaron más de 6 h. Se llama al abrir la app sin esperarla:
// lo nuevo se usa a partir del siguiente adaptador que se cree.
export async function refreshRemoteConfig(
  store: KeyValueStore,
  url: string | null = CONFIG_URL,
  options: { fetch?: typeof fetch; now?: () => number } = {},
): Promise<RefreshResult> {
  if (!url) return 'disabled';
  const doFetch = options.fetch ?? fetch;
  const now = (options.now ?? Date.now)();
  const saved = readSaved(store);
  if (saved && now - saved.fetchedAt < REFRESH_EVERY_MS) return 'fresh';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await doFetch(url, { signal: controller.signal });
    if (!response.ok) return 'failed';
    const body = await response.json();
    if (!body || typeof body.version !== 'number' || typeof body !== 'object') return 'failed';
    const { version, ...data } = body as { version: number } & Record<string, unknown>;
    const changed = !saved || saved.version !== version;
    store.setItem(KEY, JSON.stringify({ version, fetchedAt: now, data } satisfies Saved));
    return changed ? 'updated' : 'unchanged';
  } catch {
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}
