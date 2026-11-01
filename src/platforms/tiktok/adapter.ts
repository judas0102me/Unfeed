import { cachedPlatformConfig } from '../../core/config/remoteConfig';
import type { ScriptRunner } from '../../core/runner';
import { storage } from '../../core/storage';
import type { BlockReason, Category, PlatformAdapter, RemoveResult, Session } from '../types';
import * as scripts from './scripts';
import { mergeTikTokSelectors, TIKTOK, TikTokSelectors } from './selectors';

// Selectores de la app con las correcciones de la configuración remota guardada.
export function currentTikTokSelectors(): TikTokSelectors {
  return mergeTikTokSelectors(TIKTOK, cachedPlatformConfig(storage, 'tiktok'));
}

export function createTikTokAdapter(runner: ScriptRunner, sel: TikTokSelectors = currentTikTokSelectors()): PlatformAdapter {
  return {
    id: 'tiktok',
    homeUrl: sel.homeUrl,
    loginUrl: sel.loginUrl,
    userAgent: sel.userAgent,
    categories: ['reposts', 'likes', 'favorites'] satisfies Category[],

    detectSession: () => runner.run<Session>(scripts.detectSession(sel)),
    detectBlock: () => runner.run<BlockReason | null>(scripts.detectBlock(sel)),
    openCategory: category => runner.run<number>(scripts.openCategory(sel, category), 30000),
    listItems: () => runner.run<string[]>(scripts.listItems(sel)),
    loadMore: () => runner.run<number>(scripts.loadMore(sel)),
    // El script espera hasta 8 s el visor y 4 s el cambio de estado, más los cierres.
    removeItem: (category, index, options) =>
      runner.run<RemoveResult>(scripts.removeItem(sel, category, index, options?.dryRun ?? false), 25000),
  };
}
