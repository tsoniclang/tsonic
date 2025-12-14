// Generated from: Closures.ts
// Generated at: 2025-12-13T16:22:31.475Z
// WARNING: Do not modify this file manually

namespace TestCases.functions.closures
{
        public static class Closures
        {
            public static global::System.Func<double> makeCounter()
                {
                var count = 0;
                return () =>
                {
                count++;
                return count;
                };
                }

            public static global::System.Func<double, double> makeAdder(double x)
                {
                return (double y) => x + y;
                }
        }
}