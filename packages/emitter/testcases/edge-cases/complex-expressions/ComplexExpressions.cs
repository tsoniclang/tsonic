using Tsonic.Runtime;
using System.Collections.Generic;

namespace TestCases.edgecases
{
    public static class ComplexExpressions
    {
        public static double complexExpression(double a, double b, double c)
            {
            return a + b * c - a / b + c % a * b - a / c + 1.0;
            }

        public static double chainedCalls(List<double> arr)
            {
            return Tsonic.Runtime.Array.reduce(Tsonic.Runtime.Array.filter(Tsonic.Runtime.Array.map(arr, (x) => x * 2.0), (x) => x > 10.0), (acc, x) => acc + x, 0.0);
            }
    }
}
