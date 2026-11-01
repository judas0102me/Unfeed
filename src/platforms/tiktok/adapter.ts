import type { ScriptRunner } from '../../core/runner';
import type { BlockReason, Category, PlatformAdapter, RemoveResult, Session } from '../types';
import * as scripts from './scripts';
import { TIKTOK } from './selectors';

export function createTikTokAdapter(runner: ScriptRunner): PlatformAdapter {
  return {
    id: 'tiktok',
    homeUrl: TIKTOK.homeUrl,
    loginUrl: TIKTOK.loginUrl,
    userAgent: TIKTOK.userAgent,
    categories: ['reposts', 'likes', 'favorites'] satisfies Category[],

    detectSession: () => runner.run<Session>(scripts.detectSession()),
    detectBlock: () => runner.run<BlockReason | null>(scripts.detectBlock()),
    openCategory: category => runner.run<number>(scripts.openCategory(category), 30000),
    listItems: () => runner.run<string[]>(scripts.listItems()),
    loadMore: () => runner.run<number>(scripts.loadMore()),
    // El script espera hasta 8 s el visor y 4 s el cambio de estado, más los cierres.
    removeItem: (category, index, options) =>
      runner.run<RemoveResult>(scripts.removeItem(category, index, options?.dryRun ?? false), 25000),
  };
}
