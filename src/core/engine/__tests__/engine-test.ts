import type { BlockReason, Category, PlatformAdapter, RemoveResult } from '../../../platforms/types';
import { CleaningEngine, EngineOptions, EngineState, Quota } from '../engine';

type Item = { href: string; active: boolean };

type FakeOptions = {
  pageSize?: number;
  // TikTok normalmente deja el elemento en la lista (caché); con esto desaparece al eliminarlo.
  dropRemoved?: boolean;
  failHrefs?: string[];
  blockAfterRemovals?: number;
  blockReason?: BlockReason;
  detectBlock?: BlockReason | null;
  throwOnHref?: string;
  openCategoryError?: string;
};

// Adaptador simulado: imita la rejilla del perfil con paginación.
function fakeAdapter(lists: Partial<Record<Category, Item[]>>, opts: FakeOptions = {}) {
  const pageSize = opts.pageSize ?? 100;
  let current: Category = 'reposts';
  let loaded = 0;
  const removed: string[] = [];
  const calls: { category: Category; index: number }[] = [];
  const items = () => lists[current] ?? [];
  const visible = () => items().slice(0, loaded);

  const adapter: PlatformAdapter = {
    id: 'fake',
    homeUrl: '',
    loginUrl: '',
    userAgent: '',
    categories: ['reposts', 'likes', 'favorites'],
    detectSession: async () => ({ loggedIn: true, profileUrl: '/@test' }),
    detectBlock: async () => opts.detectBlock ?? null,
    openCategory: async category => {
      if (opts.openCategoryError) throw new Error(opts.openCategoryError);
      current = category;
      loaded = Math.min(pageSize, items().length);
      return loaded;
    },
    listItems: async () => visible().map(i => i.href),
    loadMore: async () => {
      loaded = Math.min(loaded + pageSize, items().length);
      return loaded;
    },
    removeItem: async (category, index, options): Promise<RemoveResult> => {
      calls.push({ category, index });
      const item = visible()[index];
      if (!item) return { outcome: 'not_found' };
      if (item.href === opts.throwOnHref) throw new Error('El script no respondió');
      if (opts.blockAfterRemovals !== undefined && removed.length >= opts.blockAfterRemovals) {
        return { outcome: 'blocked', reason: opts.blockReason ?? 'rate_limit' };
      }
      if (!item.active) return { outcome: 'inactive', href: item.href };
      if (opts.failHrefs?.includes(item.href)) return { outcome: 'failed', detail: 'sin cambio' };
      if (options?.dryRun) return { outcome: 'removed', href: item.href, simulated: true };
      item.active = false;
      removed.push(item.href);
      if (opts.dropRemoved) {
        items().splice(items().indexOf(item), 1);
        loaded--;
      }
      return { outcome: 'removed', href: item.href, simulated: false };
    },
  };
  return { adapter, removed, calls };
}

// Lista de `n` elementos; `inactive` son las posiciones ya deshechas (caché de TikTok).
function makeItems(prefix: string, n: number, inactive: number[] = []): Item[] {
  return Array.from({ length: n }, (_, i) => ({ href: `/${prefix}/${i}`, active: !inactive.includes(i) }));
}

function makeQuota(limit = Infinity) {
  let used = 0;
  const quota: Quota & { used: () => number } = {
    remaining: () => limit - used,
    consume: () => {
      used++;
    },
    used: () => used,
  };
  return quota;
}

// Sin esperas reales y con aleatoriedad fija (siempre el mínimo de cada rango).
function makeEngine(adapter: PlatformAdapter, quota: Quota = makeQuota(), options: EngineOptions = {}) {
  const sleeps: number[] = [];
  const engine = new CleaningEngine(adapter, quota, {
    sleep: async ms => {
      sleeps.push(ms);
    },
    random: () => 0,
    ...options,
  });
  return { engine, sleeps };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('CleaningEngine', () => {
  it('elimina todos los elementos activos y salta los inactivos', async () => {
    const lists = { reposts: makeItems('r', 5, [1, 3]), likes: makeItems('l', 4, [0]) };
    const { adapter, removed } = fakeAdapter(lists);
    const { engine } = makeEngine(adapter);

    const state = await engine.run(['reposts', 'likes']);

    expect(state.stopReason).toEqual({ kind: 'completed' });
    expect(removed).toEqual(['/r/0', '/r/2', '/r/4', '/l/1', '/l/2', '/l/3']);
    expect(state.stats.reposts).toEqual({ removed: 3, skipped: 2, failed: 0 });
    expect(state.stats.likes).toEqual({ removed: 3, skipped: 1, failed: 0 });
    expect(state.totalRemoved).toBe(6);
    expect(state.status).toBe('finished');
  });

  it('carga más elementos cuando se acaban los visibles', async () => {
    const { adapter, removed } = fakeAdapter({ favorites: makeItems('f', 7) }, { pageSize: 3 });
    const { engine } = makeEngine(adapter);

    const state = await engine.run(['favorites']);

    expect(state.stopReason).toEqual({ kind: 'completed' });
    expect(removed).toHaveLength(7);
  });

  it('no se salta elementos si la red los quita de la lista al eliminarlos', async () => {
    const { adapter, removed } = fakeAdapter({ likes: makeItems('l', 6, [2]) }, { dropRemoved: true, pageSize: 4 });
    const { engine } = makeEngine(adapter);

    const state = await engine.run(['likes']);

    expect(removed).toEqual(['/l/0', '/l/1', '/l/3', '/l/4', '/l/5']);
    expect(state.stats.likes).toEqual({ removed: 5, skipped: 1, failed: 0 });
  });

  it('se detiene al llegar al límite diario', async () => {
    const quota = makeQuota(2);
    const { adapter, removed } = fakeAdapter({ reposts: makeItems('r', 5) });
    const { engine } = makeEngine(adapter, quota);

    const state = await engine.run(['reposts', 'likes']);

    expect(state.stopReason).toEqual({ kind: 'daily_limit' });
    expect(removed).toEqual(['/r/0', '/r/1']);
    expect(quota.used()).toBe(2);
  });

  it('en modo prueba no gasta cupo ni elimina', async () => {
    const quota = makeQuota(1);
    const { adapter, removed } = fakeAdapter({ reposts: makeItems('r', 3) });
    const { engine } = makeEngine(adapter, quota, { dryRun: true });

    const state = await engine.run(['reposts']);

    expect(state.stopReason).toEqual({ kind: 'completed' });
    expect(removed).toEqual([]);
    expect(quota.used()).toBe(0);
    expect(state.stats.reposts.removed).toBe(3);
  });

  it('se detiene ante un bloqueo y no sigue con otras categorías', async () => {
    const lists = { reposts: makeItems('r', 5), likes: makeItems('l', 3) };
    const { adapter, removed, calls } = fakeAdapter(lists, { blockAfterRemovals: 2, blockReason: 'captcha' });
    const { engine } = makeEngine(adapter);

    const state = await engine.run(['reposts', 'likes']);

    expect(state.stopReason).toEqual({ kind: 'blocked', reason: 'captcha' });
    expect(removed).toHaveLength(2);
    expect(calls.every(c => c.category === 'reposts')).toBe(true);
  });

  it('un fallo aislado se cuenta y se continúa', async () => {
    const { adapter, removed } = fakeAdapter({ reposts: makeItems('r', 4) }, { failHrefs: ['/r/1'] });
    const { engine } = makeEngine(adapter);

    const state = await engine.run(['reposts']);

    expect(state.stopReason).toEqual({ kind: 'completed' });
    expect(removed).toEqual(['/r/0', '/r/2', '/r/3']);
    expect(state.stats.reposts.failed).toBe(1);
  });

  it('tras varios fallos seguidos se detiene', async () => {
    const failHrefs = ['/r/0', '/r/1', '/r/2'];
    const { adapter } = fakeAdapter({ reposts: makeItems('r', 5) }, { failHrefs });
    const { engine } = makeEngine(adapter);

    const state = await engine.run(['reposts']);

    expect(state.stopReason).toEqual({ kind: 'too_many_failures' });
    expect(state.stats.reposts.failed).toBe(3);
  });

  it('si tras los fallos detecta un bloqueo, lo informa', async () => {
    const failHrefs = ['/r/0', '/r/1', '/r/2'];
    const { adapter } = fakeAdapter({ reposts: makeItems('r', 5) }, { failHrefs, detectBlock: 'logged_out' });
    const { engine } = makeEngine(adapter);

    const state = await engine.run(['reposts']);

    expect(state.stopReason).toEqual({ kind: 'blocked', reason: 'logged_out' });
  });

  it('un script que no responde cuenta como fallo', async () => {
    const { adapter, removed } = fakeAdapter({ likes: makeItems('l', 3) }, { throwOnHref: '/l/1' });
    const { engine } = makeEngine(adapter);

    const state = await engine.run(['likes']);

    expect(removed).toEqual(['/l/0', '/l/2']);
    expect(state.stats.likes.failed).toBe(1);
  });

  it('si no puede abrir la categoría termina con error', async () => {
    const { adapter } = fakeAdapter({ reposts: makeItems('r', 2) }, { openCategoryError: 'Enlace de perfil no encontrado' });
    const { engine } = makeEngine(adapter);

    const state = await engine.run(['reposts']);

    expect(state.stopReason).toEqual({ kind: 'error', message: 'Enlace de perfil no encontrado' });
  });

  it('espera entre acciones y hace una pausa larga cada 20 eliminaciones', async () => {
    const { adapter } = fakeAdapter({ likes: makeItems('l', 25, [5]) });
    const { engine, sleeps } = makeEngine(adapter);
    const statuses: EngineState['status'][] = [];
    engine.subscribe(s => statuses.push(s.status));

    await engine.run(['likes']);

    expect(sleeps.filter(ms => ms === 30000)).toHaveLength(1);
    expect(sleeps.filter(ms => ms === 1500)).toHaveLength(23);
    expect(sleeps.filter(ms => ms === 500)).toHaveLength(1);
    expect(statuses).toContain('resting');
  });

  it('stop() detiene la limpieza tras el elemento en curso', async () => {
    const { adapter, removed } = fakeAdapter({ reposts: makeItems('r', 10) });
    const { engine } = makeEngine(adapter);
    engine.subscribe(s => {
      if (s.totalRemoved === 2) engine.stop();
    });

    const state = await engine.run(['reposts']);

    expect(state.stopReason).toEqual({ kind: 'stopped' });
    expect(removed).toHaveLength(2);
  });

  it('stop() corta una espera en curso', async () => {
    const { adapter } = fakeAdapter({ reposts: makeItems('r', 3) });
    // Una espera que nunca termina sola: solo stop() puede cortarla.
    const { engine } = makeEngine(adapter, makeQuota(), { sleep: () => new Promise(() => {}) });

    const running = engine.run(['reposts']);
    await flush();
    engine.stop();

    expect((await running).stopReason).toEqual({ kind: 'stopped' });
  });

  it('pause() y resume() detienen y reanudan sin perder elementos', async () => {
    const { adapter, removed } = fakeAdapter({ reposts: makeItems('r', 4) });
    const { engine } = makeEngine(adapter);
    let pausedOnce = false;
    engine.subscribe(s => {
      if (s.totalRemoved === 1 && !pausedOnce) {
        pausedOnce = true;
        engine.pause();
      }
    });

    const running = engine.run(['reposts']);
    for (let i = 0; i < 5; i++) await flush();

    expect(engine.getState().status).toBe('paused');
    expect(removed).toEqual(['/r/0']);

    engine.resume();
    const state = await running;

    expect(state.stopReason).toEqual({ kind: 'completed' });
    expect(removed).toEqual(['/r/0', '/r/1', '/r/2', '/r/3']);
  });

  it('no se puede ejecutar dos veces', async () => {
    const { adapter } = fakeAdapter({});
    const { engine } = makeEngine(adapter);
    await engine.run([]);
    await expect(engine.run([])).rejects.toThrow();
  });
});
