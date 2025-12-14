// Generated from: ArrowFunction.ts
// Generated at: 2025-12-13T16:22:31.460Z
// WARNING: Do not modify this file manually

namespace TestCases.functions.arrow
{
        public static class ArrowFunction
        {
            public static readonly global::System.Func<double, double, double> add = (double a, double b) => a + b;

            public static readonly global::System.Func<string, string> greet = (string name) =>
                {
                return $"Hello {name}";
                };
        }
}