using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace TestCases.async.basic
{
        public static class AsyncFunction
        {
            public static async Task<string> fetchData()
                {
                return await getData();
                }

            private static Task<string> getData()
                {

                }
        }
}