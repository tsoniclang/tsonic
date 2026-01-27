namespace TestCases.common.types.expectedtypethreading
{
        public static class NullishCoalescing
        {
            public static int getOrDefault(int? value)
                {
                return value ?? 100;
                }
        }
}