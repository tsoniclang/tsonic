using Tsonic.Runtime;
using System.Collections.Generic;

namespace TestCases.functions
{
    public static class RestParams
    {
        public static double sum(List<double> numbers)
            {
            return Tsonic.Runtime.Array.reduce(numbers, (acc, n) => acc + n, 0.0);
            }

        public static string concat(string separator, List<string> strings)
            {
            return Tsonic.Runtime.Array.join(strings, separator);
            }
    }
}
