export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchData(id: number): Promise<string> {
  await delay(100);
  return `Data for ID ${id}`;
}

export async function fetchMultiple(ids: number[]): Promise<string[]> {
  const promises = ids.map((id) => fetchData(id));
  return Promise.all(promises);
}

export async function processWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      await delay(100 * (i + 1)); // Exponential backoff
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

export class AsyncCache<K, V> {
  private cache: Map<K, V> = new Map();
  private loading: Map<K, Promise<V>> = new Map();

  async get(key: K, loader: () => Promise<V>): Promise<V> {
    // Check cache
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Check if already loading
    if (this.loading.has(key)) {
      return this.loading.get(key)!;
    }

    // Start loading
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
