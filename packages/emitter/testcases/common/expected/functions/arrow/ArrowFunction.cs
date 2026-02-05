namespace TestCases.common.functions.arrow
{
        public static class ArrowFunction
        {
            public static readonly global::System.Func<double, double, double> add = add__Impl;
            private static double add__Impl(double a, double b)
            {
                return a + b;
            }

            public static readonly global::System.Func<string, string> greet = greet__Impl;
            private static string greet__Impl(string name)
                {
                return $"Hello {name}";
                }
        }
}