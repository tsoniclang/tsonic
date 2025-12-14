// Generated from: RestParams.ts
// Generated at: 2025-12-13T16:22:31.488Z
// WARNING: Do not modify this file manually

namespace TestCases.functions.restparams
{
        public static class RestParams
        {
            public static double sum(global::System.Collections.Generic.List<double> numbers)
                {
                return global::Tsonic.JSRuntime.Array.reduce(numbers, (double acc, double n) => acc + n, 0);
                }

            public static string concat(string separator, global::System.Collections.Generic.List<string> strings)
                {
                return global::Tsonic.JSRuntime.Array.join(strings, separator);
                }
        }
}