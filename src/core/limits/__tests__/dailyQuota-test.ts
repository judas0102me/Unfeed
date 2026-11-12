import { memoryStore } from '../../testing/memoryStore';
import { DailyQuota, FREE_DAILY_LIMIT, localDay } from '../dailyQuota';

describe('DailyQuota', () => {
  it('empieza con 150 eliminaciones', () => {
    const quota = new DailyQuota(memoryStore());
    expect(FREE_DAILY_LIMIT).toBe(150);
    expect(quota.remaining()).toBe(150);
  });

  it('descuenta cada eliminación y no baja de 0', () => {
    const quota = new DailyQuota(memoryStore(), { limit: 2 });
    quota.consume();
    expect(quota.remaining()).toBe(1);
    quota.consume();
    quota.consume();
    expect(quota.remaining()).toBe(0);
  });

  it('se conserva entre instancias (al reabrir la app)', () => {
    const store = memoryStore();
    new DailyQuota(store).consume();
    new DailyQuota(store).consume();
    expect(new DailyQuota(store).used()).toBe(2);
  });

  it('se renueva a la medianoche local', () => {
    const store = memoryStore();
    let now = new Date(2026, 9, 31, 23, 59);
    const quota = new DailyQuota(store, { now: () => now });
    quota.consume();
    expect(quota.used()).toBe(1);

    now = new Date(2026, 10, 1, 0, 1);
    expect(quota.used()).toBe(0);
    expect(quota.remaining()).toBe(150);
  });

  it('un valor guardado dañado cuenta como 0', () => {
    const quota = new DailyQuota(memoryStore({ 'daily-quota': '{roto' }));
    expect(quota.remaining()).toBe(150);
  });

  it('formatea el día local con ceros', () => {
    expect(localDay(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});
