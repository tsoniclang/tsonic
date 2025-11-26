using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.types.unions
{
        public static class UnionTypes
        {
            public static string process(Union<string, double> value)
                {
                if (Tsonic.Runtime.Operators.@typeof(value) == "string")
                    {
                    return Tsonic.JSRuntime.String.toUpperCase(value);
                    }
                else
                    {
                    return Tsonic.JSRuntime.Number.toString(value);
                    }
                }

            public static double maybeString(string? value)
                {
                return value?.length ?? 0;
                }
        }
}