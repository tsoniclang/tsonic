namespace TestCases.operators.logical
{
        public static class LogicalOperators
        {
            public static bool isValid(string name, double age)
                {
                return global::Tsonic.JSRuntime.String.length(name) > 0.0 && age >= 18.0;
                }

            public static string getDisplayName(string? name)
                {
                return name ?? "Anonymous";
                }

            public static string classify(double age)
                {
                return age >= 18.0 ? "adult" : "minor";
                }
        }
}