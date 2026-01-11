namespace TestCases.common.async.basic
{
        public static class AsyncFunction
        {
            public static async global::System.Threading.Tasks.Task<string> FetchData()
                {
                return await getData();
                }
        }
}