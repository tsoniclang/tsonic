using Tsonic.Runtime;

namespace TestCases.functions
{
    public static class DefaultParams
    {
        public static string greet(string name, string greeting = "Hello")
            {
            return $"{greeting} {name}";
            }

        public static double multiply(double a, double b = 2.0)
            {
            return a * b;
            }
    }
}
