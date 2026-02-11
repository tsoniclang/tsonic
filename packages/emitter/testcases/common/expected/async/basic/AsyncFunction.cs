namespace TestCases.common.async.basic
{
        [global::Tsonic.Internal.ModuleContainerAttribute]
        public static class AsyncFunction
        {
            public static async global::System.Threading.Tasks.Task<string> fetchData()
                {
                return await getData();
                }
        }
}