namespace TestCases.common.types.expectedtypethreading
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class NullishFull
    {
        public static int basicNullish(int? value)
        {
            return value ?? (int)100;
        }

        public static int nestedNullish(int? a, int? b)
        {
            return a ?? (int?)b ?? (int)999;
        }

        public static int nullishWithExpr(int? value, int fallback)
        {
            return value ?? fallback;
        }

        public static int nullishInVar(int? value)
        {
            int result = value ?? (int)42;
            return result;
        }

        public static int nullishInIf(int? value, bool condition)
        {
            if (condition)
            {
                return value ?? (int)50;
            }
            return value ?? (int)60;
        }
    }
}