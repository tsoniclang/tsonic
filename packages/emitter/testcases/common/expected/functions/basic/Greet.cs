namespace TestCases.common.functions.basic
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class Greet
    {
        public static string greet(string name)
        {
            return $"Hello {name}";
        }
    }
}