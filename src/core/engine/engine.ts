// Motor de limpieza: recorre las categorías elegidas y deshace cada elemento activo,
// con ritmo humano, límite diario, pausa/reanudar y parada ante bloqueos.
// Solo habla con PlatformAdapter, así que sirve para cualquier red social.
import type { BlockReason, Category, PlatformAdapter, RemoveResult } from '../../platforms/types';

// Cupo de eliminaciones del día (plan gratis). Lo implementa el contador diario.
export type Quota = { remaining(): number; consume(): void };

// Elementos ya tratados en ejecuciones anteriores, para continuar otro día sin volver a
// abrirlos uno por uno. Lo implementa ProgressStore.
export type Progress = {
  has(category: Category, href: string): boolean;
  add(category: Category, href: string): void;
  clear(category: Category): void;
};

const NO_PROGRESS: Progress = { has: () => false, add: () => {}, clear: () => {} };

type Range = { minMs: number; maxMs: number };

export type EngineOptions = {
  // Modo prueba: localiza el botón activo sin pulsarlo y no gasta cupo.
  dryRun?: boolean;
  // Espera tras cada eliminación.
  pace?: Range;
  // Espera tras un elemento que ya estaba inactivo: también abre el visor, pero no hace clic.
  skipPace?: Range;
  // Pausa larga cada `everyMin`–`everyMax` eliminaciones.
  longPause?: Range & { everyMin: number; everyMax: number };
  // Fallos seguidos antes de detenerse.
  maxConsecutiveFailures?: number;
  // Tiempo para que el usuario resuelva un captcha. Con 0 la limpieza se detiene al verlo.
  captchaWaitMs?: number;
  captchaPollMs?: number;
  progress?: Progress;
  // Inyectables para las pruebas.
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const DEFAULTS = {
  dryRun: false,
  pace: { minMs: 1500, maxMs: 4000 },
  skipPace: { minMs: 500, maxMs: 1200 },
  longPause: { everyMin: 20, everyMax: 30, minMs: 30000, maxMs: 60000 },
  maxConsecutiveFailures: 3,
  captchaWaitMs: 0,
  captchaPollMs: 2000,
  progress: NO_PROGRESS,
  sleep: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
  random: Math.random,
} satisfies Required<EngineOptions>;

// skipped: ya estaban deshechos (por la caché de la red o por una ejecución anterior).
export type CategoryStats = { removed: number; skipped: number; failed: number };

export type StopReason =
  | { kind: 'completed' }
  | { kind: 'stopped' }
  | { kind: 'daily_limit' }
  | { kind: 'blocked'; reason: BlockReason }
  | { kind: 'too_many_failures' }
  | { kind: 'error'; message: string };

export type EngineState = {
  // resting: pausa larga automática; paused: pausa pedida por el usuario;
  // verifying: esperando a que el usuario resuelva un captcha.
  status: 'idle' | 'running' | 'paused' | 'resting' | 'verifying' | 'finished';
  category: Category | null;
  stats: Record<Category, CategoryStats>;
  totalRemoved: number;
  stopReason: StopReason | null;
};

const emptyStats = (): CategoryStats => ({ removed: 0, skipped: 0, failed: 0 });

export class CleaningEngine {
  private readonly adapter: PlatformAdapter;
  private readonly quota: Quota;
  private readonly options: Required<EngineOptions>;
  private readonly listeners = new Set<(state: EngineState) => void>();
  private state: EngineState = {
    status: 'idle',
    category: null,
    stats: { reposts: emptyStats(), likes: emptyStats(), favorites: emptyStats() },
    totalRemoved: 0,
    stopReason: null,
  };
  private stopRequested = false;
  private paused = false;
  // Despiertan la espera o la pausa en curso al detener o reanudar.
  private wakeSleep: (() => void) | null = null;
  private wakePause: (() => void) | null = null;
  private removalsSinceLongPause = 0;
  private nextLongPause: number;

  constructor(adapter: PlatformAdapter, quota: Quota, options: EngineOptions = {}) {
    this.adapter = adapter;
    this.quota = quota;
    this.options = { ...DEFAULTS, ...options };
    this.nextLongPause = this.pickLongPauseAt();
  }

  getState(): EngineState {
    return this.state;
  }

  subscribe(listener: (state: EngineState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Surte efecto al terminar el elemento en curso.
  pause() {
    if (this.state.status === 'finished' || this.state.status === 'idle') return;
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.wakePause?.();
  }

  stop() {
    this.stopRequested = true;
    this.wakeSleep?.();
    this.wakePause?.();
  }

  async run(categories: readonly Category[]): Promise<EngineState> {
    if (this.state.status !== 'idle') throw new Error('Este motor ya se ejecutó; crea uno nuevo');
    this.update({ status: 'running' });
    let stopReason: StopReason;
    try {
      stopReason = await this.runAll(categories);
    } catch (e) {
      stopReason = { kind: 'error', message: e instanceof Error ? e.message : String(e) };
    }
    this.update({ status: 'finished', category: null, stopReason });
    return this.state;
  }

  private async runAll(categories: readonly Category[]): Promise<StopReason> {
    for (const category of categories) {
      const reason = await this.runCategory(category);
      if (reason) return reason;
    }
    return { kind: 'completed' };
  }

  // Devuelve null si la categoría se terminó, o el motivo para detener todo.
  private async runCategory(category: Category): Promise<StopReason | null> {
    const { adapter, options } = this;
    this.update({ category });
    if (!(await this.checkpoint())) return { kind: 'stopped' };

    try {
      await adapter.openCategory(category);
    } catch (e) {
      const block = await adapter.detectBlock();
      if (!block) throw e;
      const stop = await this.handleBlock(block);
      if (stop) return stop;
      await adapter.openCategory(category);
    }
    let list = await adapter.listItems();
    let index = 0;
    let failures = 0;
    let notFoundStreak = 0;

    while (true) {
      if (!(await this.checkpoint())) return { kind: 'stopped' };
      if (!options.dryRun && this.quota.remaining() <= 0) return { kind: 'daily_limit' };

      if (index >= list.length) {
        await adapter.loadMore();
        list = await adapter.listItems();
        if (index >= list.length) {
          const block = await adapter.detectBlock();
          if (block) {
            const stop = await this.handleBlock(block);
            if (stop) return stop;
            continue;
          }
          // Categoría terminada: lo guardado ya no hace falta y, si el usuario vuelve a dar
          // like a algo, la próxima limpieza debe verlo.
          if (!options.dryRun) options.progress.clear(category);
          return null;
        }
      }

      // Tratado en una ejecución anterior: se salta sin abrir el visor.
      if (options.progress.has(category, list[index])) {
        this.count(category, 'skipped');
        index++;
        continue;
      }

      let result: RemoveResult;
      try {
        result = await adapter.removeItem(category, index, { dryRun: options.dryRun });
      } catch (e) {
        result = { outcome: 'failed', detail: e instanceof Error ? e.message : String(e) };
      }
      if (result.outcome !== 'not_found') notFoundStreak = 0;

      switch (result.outcome) {
        case 'blocked': {
          const stop = await this.handleBlock(result.reason);
          if (stop) return stop;
          break;
        }

        case 'not_found':
          // La lista era más corta de lo que creíamos: se carga más y, si sigue sin haber, se termina.
          if (++notFoundStreak >= 2) return null;
          list = list.slice(0, index);
          break;

        case 'failed': {
          // El captcha puede salir después de responder el script: se mira tras cada fallo.
          // Si hubo bloqueo el elemento no cuenta como fallo y se vuelve a intentar.
          const block = await adapter.detectBlock();
          if (block) {
            const stop = await this.handleBlock(block);
            if (stop) return stop;
            break;
          }
          this.count(category, 'failed');
          if (++failures >= options.maxConsecutiveFailures) return { kind: 'too_many_failures' };
          index++;
          await this.rest(options.pace);
          break;
        }

        case 'inactive': {
          failures = 0;
          this.count(category, 'skipped');
          if (!options.dryRun) options.progress.add(category, result.href);
          ({ index, list } = await this.advance(index, result.href));
          await this.rest(options.skipPace);
          break;
        }

        case 'removed': {
          failures = 0;
          this.count(category, 'removed');
          if (!options.dryRun) {
            this.quota.consume();
            options.progress.add(category, result.href);
          }
          ({ index, list } = await this.advance(index, result.href));
          await this.afterRemoval();
          break;
        }
      }
    }
  }

  // Sigue con el elemento posterior a `href` en la lista actual. Si la red lo quitó
  // de la lista, el siguiente ocupa su posición y el índice no avanza.
  private async advance(index: number, href: string): Promise<{ index: number; list: string[] }> {
    const list = await this.adapter.listItems();
    const at = list.indexOf(href);
    return { index: at === -1 ? index : at + 1, list };
  }

  private async afterRemoval() {
    if (++this.removalsSinceLongPause < this.nextLongPause) return this.rest(this.options.pace);
    this.removalsSinceLongPause = 0;
    this.nextLongPause = this.pickLongPauseAt();
    this.update({ status: 'resting' });
    await this.rest(this.options.longPause);
    if (this.state.status === 'resting') this.update({ status: 'running' });
  }

  // Espera a que el usuario reanude si pausó. Devuelve false si hay que detenerse.
  private async checkpoint(): Promise<boolean> {
    while (this.paused && !this.stopRequested) {
      this.update({ status: 'paused' });
      await new Promise<void>(resolve => (this.wakePause = resolve));
      this.wakePause = null;
    }
    if (this.state.status === 'paused') this.update({ status: 'running' });
    return !this.stopRequested;
  }

  // Espera un tiempo aleatorio del rango; se corta si se pide detener.
  // Un captcha lo puede resolver el usuario; devuelve null si la limpieza puede seguir.
  private async handleBlock(reason: BlockReason): Promise<StopReason | null> {
    const { adapter, options } = this;
    if (reason !== 'captcha' || options.captchaWaitMs <= 0) return { kind: 'blocked', reason };
    this.update({ status: 'verifying' });
    for (let waited = 0; waited < options.captchaWaitMs && !this.stopRequested; waited += options.captchaPollMs) {
      await this.rest({ minMs: options.captchaPollMs, maxMs: options.captchaPollMs });
      if (this.stopRequested) break;
      const block = await adapter.detectBlock().catch(() => reason);
      if (!block) {
        this.update({ status: 'running' });
        return null;
      }
    }
    return this.stopRequested ? { kind: 'stopped' } : { kind: 'blocked', reason };
  }

  private rest({ minMs, maxMs }: Range): Promise<void> {
    if (this.stopRequested) return Promise.resolve();
    const ms = Math.round(minMs + (maxMs - minMs) * this.options.random());
    return new Promise<void>(resolve => {
      const finish = () => {
        if (this.wakeSleep === finish) this.wakeSleep = null;
        resolve();
      };
      this.wakeSleep = finish;
      this.options.sleep(ms).then(finish);
    });
  }

  private pickLongPauseAt(): number {
    const { everyMin, everyMax } = this.options.longPause;
    return everyMin + Math.floor((everyMax - everyMin + 1) * this.options.random());
  }

  private count(category: Category, key: keyof CategoryStats) {
    const stats = { ...this.state.stats, [category]: { ...this.state.stats[category], [key]: this.state.stats[category][key] + 1 } };
    this.update({ stats, totalRemoved: this.state.totalRemoved + (key === 'removed' ? 1 : 0) });
  }

  private update(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener(this.state));
  }
}
