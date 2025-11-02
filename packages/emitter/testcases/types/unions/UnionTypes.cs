using Tsonic.Runtime;

namespace TestCases.types
{
    public static class UnionTypes
    {
        public static string process(Union<string, double> value)
            {
            if (typeof(value) == "string")
            {
            return value.ToUpper();
            }
            else
            {
            return value.ToString();
            }
            }

        public static double maybeString(string? value)
            {
            return value?.length ?? 0.0;
            }
    }
}
