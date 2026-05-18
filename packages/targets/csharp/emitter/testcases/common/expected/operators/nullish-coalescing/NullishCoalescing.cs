namespace TestCases.common.operators.nullishcoalescing
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class NullishCoalescing
    {
        public static string getDefault(string? value)
        {
            return value ?? "default";
        }

        public static double getNumber(double? value)
        {
            return value ?? 0;
        }
    }
}