using Tsonic.Runtime;

namespace TestCases.edgecases
{
    public static class ComplexExpressions
    {
        public static double complexExpression(double a, double b, double c)
            {
            return ((a + b) * c - (a / b)) + (c % a) * ((b - a) / (c + 1.0));
            }

        public static double chainedCalls(Tsonic.Runtime.Array<double> arr)
            {
            return arr.Map((x) => x * 2.0).Filter((x) => x > 10.0).Reduce((acc, x) => acc + x, 0.0);
            }
    }
}
