using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.edgecases.complexexpressions
{
        public static class ComplexExpressions
        {
            public static double complexExpression(double a, double b, double c)
                {
                return a + b * c - a / b + c % a * b - a / c + 1;
                }

            public static double chainedCalls(List<double> arr)
                {
                return Tsonic.JSRuntime.Array.reduce(Tsonic.JSRuntime.Array.filter(Tsonic.JSRuntime.Array.map(arr, (x) => x * 2), (x) => x > 10), (acc, x) => acc + x, 0);
                }
        }
}