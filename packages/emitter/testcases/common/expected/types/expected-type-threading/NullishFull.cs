namespace TestCases.common.types.expectedtypethreading
{
        public static class NullishFull
        {
            public static int BasicNullish(int? value)
                {
                return value ?? 100;
                }

            public static int NestedNullish(int? a, int? b)
                {
                return a ?? b ?? 999;
                }

            public static int NullishWithExpr(int? value, int fallback)
                {
                return value ?? fallback;
                }

            public static int NullishInVar(int? value)
                {
                int result = value ?? 42;
                return result;
                }

            public static int NullishInIf(int? value, bool condition)
                {
                if (condition)
                    {
                    return value ?? 50;
                    }
                return value ?? 60;
                }
        }
}