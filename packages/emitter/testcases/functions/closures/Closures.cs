using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System;
using System.Collections.Generic;

namespace TestCases.functions.closures
{
        public static class Closures
        {
            public static Func<double> makeCounter()
                {
                var count = 0;
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