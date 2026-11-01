// Selectores candidatos de la web de TikTok. Cada lista se prueba en orden.
// En la fase 1 este objeto se descargará de la configuración remota para
// poder corregirlo sin publicar una nueva versión de la app.

import type { Category } from '../types';

export const TIKTOK = {
  loginUrl: 'https://www.tiktok.com/login',
  // Google bloquea su OAuth dentro de WebViews: el QR o correo/teléfono son las vías válidas.
  qrLoginUrl: 'https://www.tiktok.com/login/qrcode',
  homeUrl: 'https://www.tiktok.com/',
  // La web móvil empuja a abrir la app; con un user agent de escritorio se obtiene la web completa.
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',

  loggedOut: ['[data-e2e="top-login-button"]', '[data-e2e="nav-login-button"]'],
  profileLink: ['a[data-e2e="nav-profile"]', '[data-e2e="nav-profile"] a', 'a[href^="/@"][data-e2e*="profile"]'],

  tabs: {
    reposts: ['[data-e2e="repost-tab"]', '[data-e2e="reposts-tab"]'],
    likes: ['[data-e2e="liked-tab"]'],
    favorites: ['[data-e2e="favorites-tab"]', '[data-e2e="collect-tab"]'],
  } satisfies Record<Category, string[]>,

  gridItem: [
    '[data-e2e="user-repost-item"] a',
    '[data-e2e="user-liked-item"] a',
    '[data-e2e="favorites-item"] a',
    '[data-e2e="user-post-item"] a',
    'a[href*="/video/"]',
  ],

  // Botón que deshace la acción dentro del visor de video.
  actionButton: {
    likes: ['[data-e2e="browse-like-icon"]', '[data-e2e="like-icon"]'],
    favorites: ['[data-e2e="browse-favorite-icon"]', '[data-e2e="browse-collect-icon"]', '[data-e2e="undefined-favorite-icon"]', '[data-e2e="favorite-icon"]'],
    reposts: ['[data-e2e="video-share-repost"]'],
  } satisfies Record<Category, string[]>,

  // Respaldo para reposts si cambia el data-e2e: se busca por aria-label (depende del idioma).
  removeRepostLabel: /(eliminar la publicaci[oó]n compartida|remove repost|undo repost|quitar repost)/i,

  closeViewer: ['[data-e2e="browse-close"]', 'button[aria-label="Close"]', 'button[aria-label="Cerrar"]'],

  // Sin verificar: aún no hemos visto un captcha ni un aviso de límite de TikTok en la cuenta de prueba.
  captcha: ['#captcha-verify-container', '#captcha_container', '[class*="captcha_verify" i]', 'iframe[src*="captcha"]'],
  toast: ['[role="alert"]', '[class*="toast" i]'],
  rateLimitText: /(demasiado r[aá]pido|too fast|too many|demasiadas|try again later|int[eé]ntalo m[aá]s tarde)/i,
} as const;
