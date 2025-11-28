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
                return (y) => x + y;
                }
        }
}
