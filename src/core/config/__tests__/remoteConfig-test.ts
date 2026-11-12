import { memoryStore } from '../../testing/memoryStore';
import { BUNDLED_CONFIG_VERSION, cachedPlatformConfig, refreshRemoteConfig } from '../remoteConfig';

const URL = 'https://example.test/config.json';
const ok = (body: unknown) => jest.fn(async () => ({ ok: true, json: async () => body }) as Response);

describe('remoteConfig', () => {
  it('sin URL no descarga nada', async () => {
    const fetch = ok({});
    expect(await refreshRemoteConfig(memoryStore(), null, { fetch })).toBe('disabled');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('guarda una configuración más nueva y la entrega por plataforma', async () => {
    const store = memoryStore();
    const version = BUNDLED_CONFIG_VERSION + 1;
    const result = await refreshRemoteConfig(store, URL, { fetch: ok({ version, tiktok: { gridItem: ['a'] } }) });

    expect(result).toBe('updated');
    expect(cachedPlatformConfig(store, 'tiktok')).toEqual({ gridItem: ['a'] });
    expect(cachedPlatformConfig(store, 'instagram')).toBeNull();
  });

  it('ignora una configuración que no es más nueva que la de la app', async () => {
    const store = memoryStore();
    await refreshRemoteConfig(store, URL, { fetch: ok({ version: BUNDLED_CONFIG_VERSION, tiktok: { gridItem: ['a'] } }) });
    expect(cachedPlatformConfig(store, 'tiktok')).toBeNull();
  });

  it('no vuelve a descargar antes de 6 horas', async () => {
    const store = memoryStore();
    let now = 1_000_000;
    const fetch = ok({ version: 5 });
    await refreshRemoteConfig(store, URL, { fetch, now: () => now });
    now += 5 * 60 * 60 * 1000;
    expect(await refreshRemoteConfig(store, URL, { fetch, now: () => now })).toBe('fresh');
    now += 2 * 60 * 60 * 1000;
    expect(await refreshRemoteConfig(store, URL, { fetch, now: () => now })).toBe('unchanged');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('si la descarga falla conserva lo guardado', async () => {
    const store = memoryStore();
    let now = 0;
    await refreshRemoteConfig(store, URL, { fetch: ok({ version: 9, tiktok: { toast: ['x'] } }), now: () => now });
    now += 7 * 60 * 60 * 1000;
    const failing = jest.fn(async () => {
      throw new Error('sin red');
    });
    expect(await refreshRemoteConfig(store, URL, { fetch: failing, now: () => now })).toBe('failed');
    expect(cachedPlatformConfig(store, 'tiktok')).toEqual({ toast: ['x'] });
  });

  it('rechaza respuestas sin versión', async () => {
    const store = memoryStore();
    expect(await refreshRemoteConfig(store, URL, { fetch: ok({ tiktok: {} }) })).toBe('failed');
    expect(store.data.size).toBe(0);
  });
});
