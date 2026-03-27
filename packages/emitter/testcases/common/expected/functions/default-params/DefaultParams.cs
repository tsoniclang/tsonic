namespace TestCases.common.functions.defaultparams
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class DefaultParams
    {
        public static string greet(string name, string? greeting = default)
        {
            string __defaulted_greeting = greeting ?? "Hello";
            return $"{__defaulted_greeting} {name}";
        }

        public static double multiply(double a, double? b = default)
        {
            double __defaulted_b = b ?? 2;
            return a * __defaulted_b;
        }
    }
}
