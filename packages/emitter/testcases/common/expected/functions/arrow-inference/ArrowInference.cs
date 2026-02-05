namespace TestCases.common.functions.arrowinference
{
        public static class ArrowInference
        {
            // type NumberToNumber = global::System.Func<double, double>

            public static readonly global::System.Func<double, double> @double = @double__Impl;
            private static double @double__Impl(double x)
            {
                return x * 2;
            }

            public static readonly global::System.Func<double, double> triple = triple__Impl;
            private static double triple__Impl(double x)
            {
                return x * 3;
            }

            // type BinaryOp = global::System.Func<double, double, double>

            public static readonly global::System.Func<double, double, double> add = add__Impl;
            private static double add__Impl(double a, double b)
            {
                return a + b;
            }
        }
}