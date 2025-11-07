
using Tsonic.Runtime;
using System;
using System.Threading.Tasks;

namespace TestCases.realworld
{
    public class AsyncCache<K, V>
    {
        private Map<K, V> cache = new Map();

        private Map<K, Task<V>> loading = new Map();

        public async Task<V> get(K key, Func<Task<V>> loader)
            {
            if (this.cache.has(key))
                {
                return this.cache.get(key)!;
                }
            if (this.loading.has(key))
                {
                return this.loading.get(key)!;
                }
            var promise = loader();
            this.loading.set(key, promise);
            try
            {
            var value = await promise;
            this.cache.set(key, value);
            return value;
            }
            finally
            {
            this.loading.delete(key);
            }
            }

        public void clear()
            {
            this.cache.clear();
            this.loading.clear();
            }
    }

    public static class asyncops
    {
        public static async Task delay(double ms)
            {
            return new Promise((resolve) =>
            {
            setTimeout(resolve, ms);
            });
            }

        public static async Task<string> fetchData(double id)
            {
            await delay(100.0);
            return $"Data for ID {id}";
            }

        public static async Task<Tsonic.Runtime.Array<string>> fetchMultiple(Tsonic.Runtime.Array<double> ids)
            {
            var promises = ids.map((id) => fetchData(id));
            return Promise.all(promises);
            }

        public static async Task<T> processWithRetry<T>(Func<Task<T>> fn, double maxRetries = 3.0)
            {
            System.Exception? lastError;
            for (var i = 0.0; i < maxRetries; i++)
                {
                try
                {
                return await fn();
                }
                catch (Exception error)
                {
                lastError = error;
                await delay(100.0 * i + 1.0);
                }
                }
            throw lastError || new Error("Max retries exceeded");
            }
    }
}