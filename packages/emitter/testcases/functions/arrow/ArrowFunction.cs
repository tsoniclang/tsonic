namespace TestCases.functions.arrow
{
        public static class ArrowFunction
        {
            public static readonly global::System.Func<double, double, double> add = (a, b) => a + b;

            public static readonly global::System.Func<string, string> greet = (name) =>
                {
                return $"Hello {name}";
                };
        }
}