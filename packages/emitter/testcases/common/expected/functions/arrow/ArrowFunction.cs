namespace TestCases.common.functions.arrow
{
        public static class ArrowFunction
        {
            public static readonly global::System.Func<double, double, double> Add = (double a, double b) => a + b;

            public static readonly global::System.Func<string, string> Greet = (string name) =>
                {
                return $"Hello {name}";
                };
        }
}