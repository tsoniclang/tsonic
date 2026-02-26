namespace TestCases.common.edgecases.recordnestedobject
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class RecordNestedObject
    {
        public static global::System.Collections.Generic.Dictionary<string, object?> getSettings()
        {
            return new global::System.Collections.Generic.Dictionary<string, object?> { ["authentication_methods"] = new global::System.Collections.Generic.Dictionary<string, object?> { ["password"] = true, ["dev"] = true, ["openid connect"] = false } };
        }
    }
}