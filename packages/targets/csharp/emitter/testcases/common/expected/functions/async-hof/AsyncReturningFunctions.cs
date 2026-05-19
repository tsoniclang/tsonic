namespace TestCases.common.functions.asynchof
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class AsyncReturningFunctions
    {
        public static async global::System.Threading.Tasks.Task<global::System.Func<int, int>> createMultiplier(int factor)
        {
            return (int x) => x * factor;
        }

        public static async global::System.Threading.Tasks.Task<global::System.Func<int, global::System.Threading.Tasks.Task<int>>> createAsyncAdder(int @base)
        {
            return async (int x) => @base + x;
        }

        public static async global::System.Threading.Tasks.Task<string> withAsyncCallback<T>(T value, global::System.Func<T, global::System.Threading.Tasks.Task<string>> callback)
        {
            return await callback(value);
        }
    }
}