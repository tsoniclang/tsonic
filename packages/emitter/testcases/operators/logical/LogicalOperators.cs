using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.operators.logical
{
        public static class LogicalOperators
        {
            public static bool isValid(string name, double age)
                {
                return name.length > 0 && age >= 18;
                }

            public static string getDisplayName(string? name)
                {
                return name ?? "Anonymous";
                }

            public static string classify(double age)
                {
                return age >= 18 ? "adult" : "minor";
                }
        }
}