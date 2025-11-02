using Tsonic.Runtime;

namespace TestCases.edge-cases
{
    public static class NestedScopes
    {
        public static double nestedScopes(double x)
            {
            var a = 10.0;
            {
            var b = 20.0;
            {
            var c = 30.0;
            return a + b + c + x;
            }
            }
            }
    }
}
