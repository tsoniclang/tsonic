namespace TestCases.common.functions.asynchof
{
        public static class AsyncReturningFunctions
        {
            public static async global::System.Threading.Tasks.Task<global::System.Func<int, int>> CreateMultiplier(int factor)
                {
                return (int x) => x * factor;
                }

            public static async global::System.Threading.Tasks.Task<global::System.Func<int, global::System.Threading.Tasks.Task<int>>> CreateAsyncAdder(int @base)
                {
                return async (int x) => @base + x;
                }

            public static async global::System.Threading.Tasks.Task<string> WithAsyncCallback<T>(T value, global::System.Func<T, global::System.Threading.Tasks.Task<string>> callback)
                {
                return await callback(value);
                }
        }
}