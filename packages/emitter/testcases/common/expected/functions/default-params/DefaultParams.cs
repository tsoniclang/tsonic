// Generated from: DefaultParams.ts
// Generated at: 2026-01-17T15:37:08.982Z
// WARNING: Do not modify this file manually

namespace TestCases.common.functions.defaultparams
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