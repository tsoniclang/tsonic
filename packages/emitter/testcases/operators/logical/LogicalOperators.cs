// Generated from: LogicalOperators.ts
// Generated at: 2025-12-13T16:22:31.531Z
// WARNING: Do not modify this file manually

namespace TestCases.operators.logical
{
        public static class LogicalOperators
        {
            public static bool isValid(string name, double age)
                {
                return global::Tsonic.JSRuntime.String.length(name) > 0 && age >= 18;
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