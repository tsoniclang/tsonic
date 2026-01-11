namespace TestCases.common.operators.nullishcoalescing
{
        public static class NullishCoalescing
        {
            public static string GetDefault(string? value)
                {
                return value ?? "default";
                }

            public static double GetNumber(double? value)
                {
                return value ?? 0;
                }
        }
}