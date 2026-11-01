// Cuerpos de los scripts que se inyectan en la web de TikTok. ScriptRunner los envuelve
// y cada uno responde con U.done(valor) o U.fail(error).
import type { Category } from '../types';
import type { TikTokSelectors } from './selectors';

const json = (v: unknown) => JSON.stringify(v);
const regex = (re: RegExp) => `new RegExp(${json(re.source)}, ${json(re.flags)})`;

// Elementos visibles de la pestaña: el primer selector con resultados, sin enlaces repetidos.
const items = (sel: TikTokSelectors) => `
const items = () => {
  for (const s of ${json(sel.gridItem)}) {
    const found = Array.from(document.querySelectorAll(s));
    if (!found.length) continue;
    const seen = new Set();
    return found.filter(a => {
      const href = a.getAttribute('href');
      if (!href || seen.has(href)) return false;
      seen.add(href);
      return true;
    });
  }
  return [];
};
`;

// Captcha, aviso de demasiadas acciones o sesión cerrada. Los avisos se buscan solo en
// los toasts: en el texto de la página aparecen las descripciones de los videos.
const checkBlock = (sel: TikTokSelectors) => `
const checkBlock = () => {
  if (U.find(${json(sel.captcha)})) return 'captcha';
  const rate = ${regex(sel.rateLimitText)};
  const toasts = ${json(sel.toast)}.flatMap(s => Array.from(document.querySelectorAll(s)));
  if (toasts.some(t => rate.test(t.textContent || ''))) return 'rate_limit';
  if (U.find(${json(sel.loggedOut)})) return 'logged_out';
  return null;
};
`;

export function detectSession(sel: TikTokSelectors): string {
  return `
    const loggedOut = U.find(${json(sel.loggedOut)});
    const profile = U.find(${json(sel.profileLink)});
    // Sin sesión, el enlace de perfil existe pero apunta a "/@" sin usuario.
    const raw = profile && profile.getAttribute('href');
    const href = raw && /^\\/@[^/?#]+/.test(raw) ? raw : null;
    U.done({ loggedIn: !loggedOut && !!href, profileUrl: href ? new URL(href, location.origin).href : null });
  `;
}

export function detectBlock(sel: TikTokSelectors): string {
  return `${checkBlock(sel)}
    U.done(checkBlock());
  `;
}

// Abre la pestaña de la categoría. Si no está en el perfil, entra con un clic (SPA):
// cargar la URL del perfil directamente deja la página en blanco.
export function openCategory(sel: TikTokSelectors, category: Category): string {
  return `${items(sel)}
    const tabSelectors = ${json(sel.tabs[category])};
    let tab = U.find(tabSelectors);
    if (!tab) {
      const link = await U.waitFor(${json(sel.profileLink)}, 10000);
      if (!link) return U.fail('Enlace de perfil no encontrado');
      link.click();
      tab = await U.waitFor(tabSelectors, 10000);
    }
    if (!tab) return U.fail('Pestaña no encontrada en el perfil');
    tab.click();
    // La rejilla anterior sigue visible un momento tras cambiar de pestaña,
    // y la de favoritos tarda varios segundos más que las otras en cargar.
    await U.sleep(2500);
    await U.waitUntil(() => items().length, 8000);
    U.done(items().length);
  `;
}

export function listItems(sel: TikTokSelectors): string {
  return `${items(sel)}
    U.done(items().map(a => a.getAttribute('href')));
  `;
}

export function loadMore(sel: TikTokSelectors): string {
  return `${items(sel)}
    const before = items();
    if (before.length) before[before.length - 1].scrollIntoView({ block: 'end' });
    window.scrollTo(0, document.body.scrollHeight);
    await U.waitUntil(() => items().length > before.length, 5000);
    U.done(items().length);
  `;
}

// Abre el elemento `index` de la pestaña actual y deshace la acción.
// Con dryRun localiza el botón activo pero no hace el clic final.
export function removeItem(sel: TikTokSelectors, category: Category, index: number, dryRun: boolean): string {
  return `${items(sel)}${checkBlock(sel)}
    const blockedBefore = checkBlock();
    if (blockedBefore) return U.done({ outcome: 'blocked', reason: blockedBefore });

    const item = items()[${json(index)}];
    if (!item) return U.done({ outcome: 'not_found' });
    const href = item.getAttribute('href');
    item.click();

    const re = ${regex(sel.removeRepostLabel)};
    const byLabel = () => ${json(category)} === 'reposts'
      ? Array.from(document.querySelectorAll('[aria-label]')).find(el => re.test(el.getAttribute('aria-label') || ''))
      : null;
    const close = async () => {
      const c = U.find(${json(sel.closeViewer)});
      if (c) c.click();
      await U.sleep(800);
    };
    const failure = async detail => {
      const reason = checkBlock();
      await close();
      U.done(reason ? { outcome: 'blocked', reason } : { outcome: 'failed', detail });
    };

    const found = await U.waitUntil(() => U.find(${json(sel.actionButton[category])}) || byLabel(), 8000);
    if (!found) return failure('Botón de acción no encontrado en el visor');
    const button = found.closest('button, a') || found;

    // Solo se pulsa si la acción está activa: un clic sobre un botón inactivo AGREGARÍA un like/favorito/repost.
    const isActive = () => {
      if (${json(category)} === 'reposts') return re.test(button.getAttribute('aria-label') || '');
      if (button.getAttribute('aria-pressed') !== null) return button.getAttribute('aria-pressed') === 'true';
      // Sin aria-pressed (favoritos): activo si algún trazo tiene color (p. ej. #FACE15, el amarillo de TikTok).
      const neutral = /^(|none|currentcolor|#000|#000000|#fff|#ffffff|black|white)$/i;
      return Array.from(button.querySelectorAll('svg, path, g')).some(n => !neutral.test(n.getAttribute('fill') || ''));
    };

    if (!isActive()) { await close(); return U.done({ outcome: 'inactive', href }); }
    if (${json(dryRun)}) { await close(); return U.done({ outcome: 'removed', href, simulated: true }); }
    button.click();

    const undone = await U.waitUntil(() => !isActive(), 4000);
    if (!undone) return failure('Se pulsó pero el estado no cambió');
    await close();
    U.done({ outcome: 'removed', href, simulated: false });
  `;
}

// Cierra la sesión con el mismo endpoint que usa el botón de la web. Sin verificar todavía.
export function logout(): string {
  return `
    await fetch('/passport/web/logout/', { credentials: 'include' });
    U.done(null);
  `;
}

// Solo para el panel de depuración: atributos data-e2e y etiquetas de botones de la página.
export function inspectPage(): string {
  return `
    const e2e = {};
    document.querySelectorAll('[data-e2e]').forEach(el => {
      const k = el.getAttribute('data-e2e');
      e2e[k] = (e2e[k] || 0) + 1;
    });
    const labels = [];
    document.querySelectorAll('button, [role="button"], [aria-label]').forEach(el => {
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
      if (label && label.length < 40 && !labels.includes(label)) labels.push(label);
    });
    const body = document.body;
    U.done({
      url: location.href,
      title: document.title,
      textLength: body ? body.innerText.length : 0,
      snippet: body ? body.innerHTML.slice(0, 400) : '',
      e2e,
      labels: labels.slice(0, 80),
    });
  `;
}
