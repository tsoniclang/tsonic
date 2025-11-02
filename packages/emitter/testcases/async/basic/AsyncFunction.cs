using Tsonic.Runtime;
using System.Threading.Tasks;

namespace TestCases.async
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
