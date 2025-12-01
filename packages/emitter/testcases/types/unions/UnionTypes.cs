namespace TestCases.types.unions
{
        public static class UnionTypes
        {
            public static string process(global::Tsonic.Runtime.Union<string, double> value)
                {
                if (global::Tsonic.Runtime.Operators.@typeof(value) == "string")
                    {
                    return global::Tsonic.JSRuntime.String.toUpperCase(value);
                    }
                else
                    {
                    return global::Tsonic.JSRuntime.Number.toString(value);
                    }
                }

            public static double maybeString(string? value)
                {
                return value?.length ?? 0;
                }
        }
}
