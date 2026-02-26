namespace TestCases.common.types.dictionaries
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class Dictionaries
    {
        public static global::System.Collections.Generic.Dictionary<string, double> getStringDict()
        {
            return new global::System.Collections.Generic.Dictionary<string, double>();
        }

        public static global::System.Collections.Generic.Dictionary<double, string> getNumberDict()
        {
            return new global::System.Collections.Generic.Dictionary<double, string>();
        }

        public static string? lookupByNumber(global::System.Collections.Generic.Dictionary<double, string> dict, double key)
        {
            return dict[key];
        }
    }
}