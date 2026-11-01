import type { Category } from '../../platforms/types';
import type { KeyValueStore } from '../storage';
import type { Progress } from './engine';

// Enlaces ya tratados por categoría, guardados para continuar la limpieza otro día.
export class ProgressStore implements Progress {
  private readonly store: KeyValueStore;
  private readonly platformId: string;
  private readonly cache = new Map<Category, Set<string>>();

  constructor(store: KeyValueStore, platformId: string) {
    this.store = store;
    this.platformId = platformId;
  }

  has(category: Category, href: string): boolean {
    return this.load(category).has(href);
  }

  add(category: Category, href: string): void {
    const set = this.load(category);
    if (set.has(href)) return;
    set.add(href);
    this.store.setItem(this.key(category), JSON.stringify([...set]));
  }

  clear(category: Category): void {
    this.cache.set(category, new Set());
    this.store.removeItem(this.key(category));
  }

  size(category: Category): number {
    return this.load(category).size;
  }

  private key(category: Category) {
    return `progress:${this.platformId}:${category}`;
  }

  private load(category: Category): Set<string> {
    let set = this.cache.get(category);
    if (!set) {
      try {
        const saved = JSON.parse(this.store.getItem(this.key(category)) ?? '[]');
        set = new Set(Array.isArray(saved) ? saved.filter(h => typeof h === 'string') : []);
      } catch {
        set = new Set();
      }
      this.cache.set(category, set);
    }
    return set;
  }
}
