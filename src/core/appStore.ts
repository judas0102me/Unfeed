// Preferencias y datos de la app guardados en el teléfono.
import type { EngineOptions, EngineState } from './engine/engine';
import { storage } from './storage';

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = storage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => storage.setItem(key, JSON.stringify(value));

export type Speed = 'normal' | 'careful';

// Cuidadosa: más lenta, para cuentas que ya recibieron avisos de TikTok.
export function paceFor(speed: Speed): Pick<EngineOptions, 'pace' | 'longPause'> {
  return speed === 'careful'
    ? { pace: { minMs: 3500, maxMs: 7000 }, longPause: { everyMin: 12, everyMax: 18, minMs: 60000, maxMs: 120000 } }
    : {};
}

export type Account = { platform: 'tiktok'; profileUrl: string; handle: string };

export function accountFromProfileUrl(profileUrl: string): Account {
  const handle = decodeURIComponent(new URL(profileUrl).pathname.split('/')[1] ?? '').replace(/^@/, '');
  return { platform: 'tiktok', profileUrl, handle };
}

export type LastRun = Pick<EngineState, 'stats' | 'totalRemoved' | 'stopReason'> & { finishedAt: number; dryRun: boolean };

export const appStore = {
  isOnboarded: () => read<boolean>('onboarded', false),
  setOnboarded: () => write('onboarded', true),

  account: () => read<Account | null>('account', null),
  setAccount: (account: Account) => write('account', account),
  clearAccount: () => storage.removeItem('account'),

  speed: () => read<Speed>('speed', 'normal'),
  setSpeed: (speed: Speed) => write('speed', speed),

  // Solo en desarrollo: limpieza sin el clic final.
  dryRun: () => __DEV__ && read<boolean>('dry-run', false),
  setDryRun: (value: boolean) => write('dry-run', value),

  lastRun: () => read<LastRun | null>('last-run', null),
  setLastRun: (run: LastRun) => write('last-run', run),
};
