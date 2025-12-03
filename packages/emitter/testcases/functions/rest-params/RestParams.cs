namespace TestCases.functions.restparams
{
        public static class RestParams
        {
            public static double sum(global::System.Collections.Generic.List<double> numbers)
                {
                return global::Tsonic.JSRuntime.Array.reduce(numbers, (acc, n) => acc + n, 0.0);
                }

            public static string concat(string separator, global::System.Collections.Generic.List<string> strings)
                {
                return global::Tsonic.JSRuntime.Array.join(strings, separator);
                }
        }
}