namespace TestCases.common.types.expectedtypethreading
{
        public static class NullishCoalescing
        {
            public static int GetOrDefault(int? value)
                {
                return value ?? 100;
                }
        }
}