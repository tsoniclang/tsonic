using Tsonic.Runtime;

namespace TestCases.functions
{
    public static class RestParams
    {
        public static double sum(Tsonic.Runtime.Array<double> numbers)
            {
            return numbers.reduce((acc, n) => acc + n, 0.0);
            }

        public static string concat(string separator, Tsonic.Runtime.Array<string> strings)
            {
            return strings.join(separator);
            }
    }
}
