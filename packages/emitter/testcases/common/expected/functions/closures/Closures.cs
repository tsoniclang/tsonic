namespace TestCases.common.functions.closures
{
        public static class Closures
        {
            public static global::System.Func<double> MakeCounter()
                {
                var count = 0;
                return () =>
                {
                count++;
                return count;
                };
                }

            public static global::System.Func<double, double> MakeAdder(double x)
                {
                return (double y) => x + y;
                }
        }
}