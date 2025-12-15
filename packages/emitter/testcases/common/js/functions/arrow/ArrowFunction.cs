namespace TestCases.common.functions.arrow
{
        public static class ArrowFunction
        {
            public static readonly global::System.Func<double, double, double> add = (double a, double b) => a + b;

            public static readonly global::System.Func<string, string> greet = (string name) =>
                {
                return $"Hello {name}";
                };
        }
}