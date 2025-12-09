namespace TestCases.edgecases.complexexpressions
{
        public static class ComplexExpressions
        {
            public static double complexExpression(double a, double b, double c)
                {
                return (a + b) * c - a / b + c % a * ((b - a) / (c + 1.0));
                }

            public static double chainedCalls(global::System.Collections.Generic.List<double> arr)
                {
                return global::Tsonic.JSRuntime.Array.reduce(global::Tsonic.JSRuntime.Array.filter(global::Tsonic.JSRuntime.Array.map(arr, (double x) => x * 2.0), (double x) => x > 10.0), (double acc, double x) => acc + x, 0.0);
                }
        }
}