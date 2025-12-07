// NEGATIVE TEST: This file uses Map which is not in globals packages
// Demonstrates real-world pattern (async cache) that requires Map
// In noLib mode, TS should fail to resolve 'Map'

export class AsyncCache<K, V> {
  // ERROR: Cannot find name 'Map'
  private cache: Map<K, V> = new Map();
  private loading: Map<K, Promise<V>> = new Map();

  async get(key: K, loader: () => Promise<V>): Promise<V> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    if (this.loading.has(key)) {
      return this.loading.get(key)!;
    }

    const promise = loader();
    this.loading.set(key, promise);

    try {
      const value = await promise;
      this.cache.set(key, value);
      return value;
    } finally {
      this.loading.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
    this.loading.clear();
  }
}
