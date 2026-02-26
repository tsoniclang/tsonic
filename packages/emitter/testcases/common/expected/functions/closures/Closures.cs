namespace TestCases.common.functions.closures
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
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