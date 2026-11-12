import { mergeTikTokSelectors, TIKTOK } from '../selectors';

describe('mergeTikTokSelectors', () => {
  it('sin configuración remota devuelve los de la app', () => {
    expect(mergeTikTokSelectors(TIKTOK, null)).toBe(TIKTOK);
  });

  it('reemplaza listas, categorías y expresiones válidas', () => {
    const merged = mergeTikTokSelectors(TIKTOK, {
      gridItem: ['[data-e2e="nuevo-item"] a'],
      actionButton: { likes: ['[data-e2e="nuevo-like"]'] },
      rateLimitText: { source: 'slow down', flags: 'i' },
    });
    expect(merged.gridItem).toEqual(['[data-e2e="nuevo-item"] a']);
    expect(merged.actionButton.likes).toEqual(['[data-e2e="nuevo-like"]']);
    expect(merged.actionButton.reposts).toEqual(TIKTOK.actionButton.reposts);
    expect(merged.rateLimitText.test('Please SLOW DOWN')).toBe(true);
  });

  it('ignora valores inválidos y no modifica los de la app', () => {
    const before = JSON.stringify(TIKTOK.actionButton);
    const merged = mergeTikTokSelectors(TIKTOK, {
      gridItem: [],
      closeViewer: [1, 2],
      tabs: { likes: 'no es lista' },
      actionButton: { favorites: ['ok'] },
      removeRepostLabel: { source: '(' },
      userAgent: 'curl/8',
    });
    expect(merged.gridItem).toEqual(TIKTOK.gridItem);
    expect(merged.closeViewer).toEqual(TIKTOK.closeViewer);
    expect(merged.tabs.likes).toEqual(TIKTOK.tabs.likes);
    expect(merged.removeRepostLabel).toBe(TIKTOK.removeRepostLabel);
    expect(merged.userAgent).toBe(TIKTOK.userAgent);
    expect(JSON.stringify(TIKTOK.actionButton)).toBe(before);
  });

  it('no permite cambiar las URLs desde remoto', () => {
    const merged = mergeTikTokSelectors(TIKTOK, { loginUrl: 'https://evil.test', homeUrl: 'https://evil.test' });
    expect(merged.loginUrl).toBe(TIKTOK.loginUrl);
    expect(merged.homeUrl).toBe(TIKTOK.homeUrl);
  });
});
