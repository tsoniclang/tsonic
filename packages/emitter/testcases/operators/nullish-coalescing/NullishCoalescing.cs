namespace TestCases.operators.nullishcoalescing
{
        public static class NullishCoalescing
        {
            public static string getDefault(string? value)
                {
                return value ?? "default";
                }

            public static double getNumber(double? value)
                {
                return value ?? 0;
                }
        }
}
