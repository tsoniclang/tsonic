namespace TestCases.common.functions.arrowinference
{
        public static class ArrowInference
        {
            // type NumberToNumber = global::System.Func<double, double>

            public static readonly global::System.Func<double, double> Double = (double x) => x * 2;

            public static readonly global::System.Func<double, double> Triple = (double x) => x * 3;

            // type BinaryOp = global::System.Func<double, double, double>

            public static readonly global::System.Func<double, double, double> Add = (double a, double b) => a + b;
        }
}