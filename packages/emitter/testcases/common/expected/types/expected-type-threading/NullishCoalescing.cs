namespace TestCases.common.types.expectedtypethreading
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class NullishCoalescing
    {
        public static int getOrDefault(int? value)
        {
            return value ?? 100;
        }
    }
}