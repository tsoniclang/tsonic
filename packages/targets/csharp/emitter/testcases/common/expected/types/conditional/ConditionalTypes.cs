namespace TestCases.common.types.conditional
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ConditionalTypes
    {
        public static string greet(string name)
        {
            return $"Hello {(global::js.Globals.String(name))}";
        }
    }
}
