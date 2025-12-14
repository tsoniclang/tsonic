// Generated from: DefaultParams.ts
// Generated at: 2025-12-13T16:22:31.481Z
// WARNING: Do not modify this file manually

namespace TestCases.functions.defaultparams
{
        public static class DefaultParams
        {
            public static string greet(string name, string greeting = "Hello")
                {
                return $"{greeting} {name}";
                }

            public static double multiply(double a, double b = 2)
                {
                return a * b;
                }
        }
}