import type { Quota } from '../engine/engine';
import type { KeyValueStore } from '../storage';

export const FREE_DAILY_LIMIT = 150;

const KEY = 'daily-quota';

// Día según el reloj del teléfono: el cupo se renueva a la medianoche local.
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Eliminaciones del plan gratis. Solo se guarda el día en curso: al cambiar de día vuelve a 0.
export class DailyQuota implements Quota {
  private readonly store: KeyValueStore;
  private readonly limit: number;
  private readonly now: () => Date;

  constructor(store: KeyValueStore, options: { limit?: number; now?: () => Date } = {}) {
    this.store = store;
    this.limit = options.limit ?? FREE_DAILY_LIMIT;
    this.now = options.now ?? (() => new Date());
  }

  used(): number {
    try {
      const saved = JSON.parse(this.store.getItem(KEY) ?? 'null');
      return saved?.day === localDay(this.now()) && Number.isInteger(saved.used) ? saved.used : 0;
    } catch {
      return 0;
    }
  }

  remaining(): number {
    return Math.max(0, this.limit - this.used());
  }

  consume(): void {
    this.store.setItem(KEY, JSON.stringify({ day: localDay(this.now()), used: this.used() + 1 }));
  }
}
