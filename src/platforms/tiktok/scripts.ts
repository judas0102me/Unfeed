import { wrapScript } from '../../core/bridge';
import { Category, TIKTOK } from './selectors';

const json = (v: unknown) => JSON.stringify(v);

export function detectSession(): string {
  return wrapScript('session', `
    const loggedOut = U.find(${json(TIKTOK.loggedOut)});
    const profile = U.find(${json(TIKTOK.profileLink)});
    // Sin sesión, el enlace de perfil existe pero apunta a "/@" sin usuario.
    const raw = profile && profile.getAttribute('href');
    const href = raw && /^\\/@[^/?#]+/.test(raw) ? raw : null;
    U.post({
      type: 'session',
      loggedIn: !loggedOut && !!href,
      profileUrl: href ? new URL(href, location.origin).href : null,
    });
  `);
}

// Lista todos los atributos data-e2e de la página: sirve para descubrir los selectores reales.
export function inspectPage(): string {
  return wrapScript('inspect', `
    const e2e = {};
    document.querySelectorAll('[data-e2e]').forEach(el => {
      const k = el.getAttribute('data-e2e');
      e2e[k] = (e2e[k] || 0) + 1;
    });
    // Etiquetas de botones (aria-label o texto corto): sirven para localizar acciones sin data-e2e.
    const labels = [];
    document.querySelectorAll('button, [role="button"], [aria-label]').forEach(el => {
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
      if (label && label.length < 40 && !labels.includes(label)) labels.push(label);
    });
    // Estado de los botones del visor: para saber si un like/favorito está activo antes de pulsarlo.
    ['browse-like-icon', 'browse-favorite-icon', 'video-share-repost'].forEach(k => {
      const el = document.querySelector('[data-e2e="' + k + '"]');
      if (!el) return;
      const btn = el.closest('button') || el;
      U.log(k + ' → ' + btn.outerHTML.replace(/<path[^>]*>/g, '').slice(0, 500));
    });
    const body = document.body;
    U.post({
      type: 'inspect',
      url: location.href,
      title: document.title,
      textLength: body ? body.innerText.length : 0,
      snippet: body ? body.innerHTML.slice(0, 400) : '',
      e2e,
      labels: labels.slice(0, 80),
    });
  `);
}

// Navega al perfil con un clic dentro de la web (SPA), en lugar de recargar la página.
export function goToProfile(): string {
  return wrapScript('goToProfile', `
    const link = await U.waitFor(${json(TIKTOK.profileLink)}, 10000);
    if (!link) {
      U.post({ type: 'result', action: 'goToProfile', ok: false, detail: 'Enlace de perfil no encontrado' });
      return;
    }
    link.click();
    await U.sleep(3000);
    U.post({ type: 'result', action: 'goToProfile', ok: true, detail: location.href });
  `);
}

export function openTab(category: Category): string {
  const action = 'openTab:' + category;
  return wrapScript(action, `
    const tab = await U.waitFor(${json(TIKTOK.tabs[category])}, 6000);
    if (!tab) {
      U.post({ type: 'result', action: ${json(action)}, ok: false, detail: 'Pestaña no encontrada. ¿Estás en tu perfil?' });
      return;
    }
    tab.click();
    await U.sleep(2500);
    const count = document.querySelectorAll('a[href*="/video/"]').length;
    U.post({ type: 'result', action: ${json(action)}, ok: true, detail: 'Pestaña abierta, ' + count + ' videos visibles' });
  `);
}

// Abre el primer elemento de la pestaña actual y deshace la acción.
// Con dryRun solo localiza los elementos y no hace el clic final.
export function removeOne(category: Category, dryRun: boolean): string {
  const action = 'remove:' + category;
  return wrapScript(action, `
    const done = (ok, detail) => U.post({ type: 'result', action: ${json(action)}, ok, detail });

    const item = U.find(${json(TIKTOK.gridItem)});
    if (!item) return done(false, 'No hay videos en la pestaña');
    U.log('Abriendo ' + item.getAttribute('href'));
    item.click();

    const re = new RegExp(${json(TIKTOK.removeRepostLabel.source)}, ${json(TIKTOK.removeRepostLabel.flags)});
    const byLabel = () => ${json(category)} === 'reposts'
      ? Array.from(document.querySelectorAll('[aria-label]')).find(el => re.test(el.getAttribute('aria-label') || ''))
      : null;
    const found = await U.waitUntil(() => U.find(${json(TIKTOK.actionButton[category])}) || byLabel(), 8000);
    if (!found) return done(false, 'Botón de acción no encontrado en el visor');
    const button = found.closest('button, a') || found;

    // Solo se pulsa si la acción está activa: un clic sobre un botón inactivo AGREGARÍA un like/favorito/repost.
    const isActive = () => {
      if (${json(category)} === 'reposts') return re.test(button.getAttribute('aria-label') || '');
      if (button.getAttribute('aria-pressed') !== null) return button.getAttribute('aria-pressed') === 'true';
      // Sin aria-pressed (favoritos): activo si algún trazo tiene color (p. ej. #FACE15, el amarillo de TikTok).
      const neutral = /^(|none|currentcolor|#000|#000000|#fff|#ffffff|black|white)$/i;
      return Array.from(button.querySelectorAll('svg, path, g')).some(n => !neutral.test(n.getAttribute('fill') || ''));
    };
    const describe = () => U.describe(button) + ' fills=' +
      Array.from(button.querySelectorAll('svg, path, g')).map(n => n.getAttribute('fill')).filter(Boolean).join(',');
    U.log('Botón: ' + describe() + ' · activo=' + isActive());

    const close = () => { const c = U.find(${json(TIKTOK.closeViewer)}); if (c) c.click(); };
    if (!isActive()) { close(); return done(false, 'La acción no está activa en este video; no se pulsa'); }
    if (${json(dryRun)}) { close(); return done(true, 'Modo prueba: botón activo localizado, sin clic'); }
    button.click();

    const undone = await U.waitUntil(() => !isActive(), 4000);
    U.log('Después: ' + describe());
    close();
    done(!!undone, undone ? 'Acción deshecha' : 'Se pulsó pero el estado no cambió');
  `);
}
