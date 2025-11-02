using Tsonic.Runtime;

namespace TestCases.types
{
    public static class UnionTypes
    {
        public static string process(Union<string, double> value)
            {
            if (Tsonic.Runtime.Operators.@typeof(value) == "string")
                {
                return Tsonic.Runtime.String.toUpperCase(value);
                }
            else
                {
                return Tsonic.Runtime.Number.toString(value);
                }
            }

        public static double maybeString(string? value)
            {
            return value?.length ?? 0.0;
            }
    }
}
