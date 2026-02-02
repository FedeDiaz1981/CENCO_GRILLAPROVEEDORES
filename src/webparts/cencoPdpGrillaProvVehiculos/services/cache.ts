// services/cache.ts
type CacheEntry<T> = { value: Promise<T>; ts: number };

export class SimplePromiseCache {
  private map = new Map<string, CacheEntry<unknown>>();

  constructor(private ttlMs: number = 10 * 60 * 1000) {} // 10 min

  get<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.map.get(key) as CacheEntry<T> | undefined;
    if (hit && now - hit.ts < this.ttlMs) return hit.value;

    const value = factory().catch((e) => {
      this.map.delete(key);
      throw e;
    });

    this.map.set(key, { value: value as Promise<unknown>, ts: now });
    return value;
  }

  clear(prefix?: string): void {
    if (!prefix) {
      this.map.clear();
      return;
    }
    for (const k of this.map.keys()) {
      if (k.startsWith(prefix)) this.map.delete(k);
    }
  }
}
