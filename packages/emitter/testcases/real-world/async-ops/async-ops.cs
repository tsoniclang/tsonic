namespace TestCases.realworld.asyncops
{
    public class AsyncCache<K, V>
    {
        private global::Tsonic.JSRuntime.Map<K, V> cache = new global::Tsonic.JSRuntime.Map();

        private global::Tsonic.JSRuntime.Map<K, global::System.Threading.Tasks.Task<V>> loading = new global::Tsonic.JSRuntime.Map();

        public async global::System.Threading.Tasks.Task<V> get(K key, global::System.Func<global::System.Threading.Tasks.Task<V>> loader)
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
                public static async global::System.Threading.Tasks.Task delay(double ms)
                    {
                    return new Promise((global::System.Action resolve) =>
                    {
                    setTimeout(resolve, ms);
                    });
                    }

                public static async global::System.Threading.Tasks.Task<string> fetchData(double id)
                    {
                    await delay(100.0);
                    return $"Data for ID {id}";
                    }

                public static async global::System.Threading.Tasks.Task<global::System.Collections.Generic.List<string>> fetchMultiple(global::System.Collections.Generic.List<double> ids)
                    {
                    var promises = global::Tsonic.JSRuntime.Array.map(ids, (double id) => fetchData(id));
                    return Promise.all(promises);
                    }

                public static async global::System.Threading.Tasks.Task<T> processWithRetry<T>(global::System.Func<global::System.Threading.Tasks.Task<T>> fn, double maxRetries = 3.0)
                    {
                    global::System.Exception? lastError;
                    for (int i = 0; i < maxRetries; i++)
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
                    throw lastError ?? new Error("Max retries exceeded");
                    }
            }
}