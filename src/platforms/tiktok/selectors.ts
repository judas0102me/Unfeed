// Selectores candidatos de la web de TikTok. Cada lista se prueba en orden.
// La configuración remota puede reemplazarlos (mergeTikTokSelectors) para corregir
// la app cuando TikTok cambia su web, sin publicar una versión nueva.

import type { Category } from '../types';

export type TikTokSelectors = {
  loginUrl: string;
  qrLoginUrl: string;
  homeUrl: string;
  userAgent: string;
  loggedOut: string[];
  profileLink: string[];
  tabs: Record<Category, string[]>;
  gridItem: string[];
  actionButton: Record<Category, string[]>;
  removeRepostLabel: RegExp;
  closeViewer: string[];
  captcha: string[];
  dialog: string[];
  captchaText: RegExp;
  toast: string[];
  rateLimitText: RegExp;
};

export const TIKTOK: TikTokSelectors = {
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
  },

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
  },

  // Respaldo para reposts si cambia el data-e2e: se busca por aria-label (depende del idioma).
  removeRepostLabel: /(eliminar la publicaci[oó]n compartida|remove repost|undo repost|quitar repost)/i,

  closeViewer: ['[data-e2e="browse-close"]', 'button[aria-label="Close"]', 'button[aria-label="Cerrar"]'],

  // Visto en TikTok el 3 nov 2026: #captcha-verify-container-main-page y botones #captcha_*.
  captcha: ['[id*="captcha" i]', 'iframe[src*="captcha"]'],
  // Respaldo por texto, solo dentro de ventanas: en la página aparecen descripciones de videos.
  dialog: ['[role="dialog"]', '[class*="modal" i]'],
  captchaText: /(slider to fit the puzzle|completa el rompecabezas|arrastra el control|desliza .*rompecabezas|verify to continue)/i,
  // Sin verificar: aún no hemos visto un aviso de límite de TikTok en la cuenta de prueba.
  toast: ['[role="alert"]', '[class*="toast" i]'],
  rateLimitText: /(demasiado r[aá]pido|too fast|too many|demasiadas|try again later|int[eé]ntalo m[aá]s tarde)/i,
};

const CATEGORIES: Category[] = ['reposts', 'likes', 'favorites'];
const LIST_KEYS = ['loggedOut', 'profileLink', 'gridItem', 'closeViewer', 'captcha', 'dialog', 'toast'] as const;
const BY_CATEGORY_KEYS = ['tabs', 'actionButton'] as const;
const REGEX_KEYS = ['removeRepostLabel', 'captchaText', 'rateLimitText'] as const;

const isList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.every(s => typeof s === 'string' && s.length > 0);

function toRegExp(v: unknown): RegExp | null {
  if (!v || typeof v !== 'object') return null;
  const { source, flags } = v as { source?: unknown; flags?: unknown };
  if (typeof source !== 'string' || (flags !== undefined && typeof flags !== 'string')) return null;
  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

// Aplica sobre `base` los valores remotos válidos e ignora el resto. Las URLs no se
// pueden cambiar en remoto: si alguien comprometiera el servidor de configuración,
// no podría llevar al usuario a otra página para robarle la sesión.
export function mergeTikTokSelectors(base: TikTokSelectors, remote: unknown): TikTokSelectors {
  if (!remote || typeof remote !== 'object') return base;
  const r = remote as Record<string, unknown>;
  const merged: TikTokSelectors = { ...base, tabs: { ...base.tabs }, actionButton: { ...base.actionButton } };

  if (typeof r.userAgent === 'string' && r.userAgent.startsWith('Mozilla/')) merged.userAgent = r.userAgent;
  for (const key of LIST_KEYS) {
    const value = r[key];
    if (isList(value)) merged[key] = value;
  }
  for (const key of BY_CATEGORY_KEYS) {
    const value = r[key];
    if (!value || typeof value !== 'object') continue;
    for (const category of CATEGORIES) {
      const list = (value as Record<string, unknown>)[category];
      if (isList(list)) merged[key][category] = list;
    }
  }
  for (const key of REGEX_KEYS) {
    const re = toRegExp(r[key]);
    if (re) merged[key] = re;
  }
  return merged;
}
