using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.functions.restparams
{
        public static class RestParams
        {
            public static double sum(List<double> numbers)
                {
                return Tsonic.JSRuntime.Array.reduce(numbers, (acc, n) => acc + n, 0);
                }

            public static string concat(string separator, List<string> strings)
                {
                return Tsonic.JSRuntime.Array.join(strings, separator);
                }
        }
}