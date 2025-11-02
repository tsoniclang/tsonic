using Tsonic.Runtime;

namespace TestCases.operators
{
    public static class LogicalOperators
    {
        public static bool isValid(string name, double age)
            {
            return name.length > 0.0 && age >= 18.0;
            }

        public static string getDisplayName(string? name)
            {
            return name || "Anonymous";
            }

        public static string classify(double age)
            {
            return age >= 18.0 ? "adult" : "minor";
            }
    }
}
