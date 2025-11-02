using Tsonic.Runtime;
using System;

namespace TestCases.functions
{
    public static class Closures
    {
        public static Func<double> makeCounter()
            {
            var count = 0.0;
            return () =>
            {
            count++;
            return count;
            };
            }

        public static Func<double, double> makeAdder(double x)
            {
            return (y) => x + y;
            }
    }
}
