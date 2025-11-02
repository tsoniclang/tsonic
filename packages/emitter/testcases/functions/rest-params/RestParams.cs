using Tsonic.Runtime;

namespace TestCases.functions
{
    public static class RestParams
    {
        public static double sum(params double[] numbers)
            {
            return numbers.Reduce((acc, n) => acc + n, 0.0);
            }

        public static string concat(string separator, params string[] strings)
            {
            return strings.Join(separator);
            }
    }
}
