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
            return ((global::System.Func<string?>)(() =>
                {
                var __tsonic_dict = dict;
                var __tsonic_key = key;
                return __tsonic_dict.ContainsKey(__tsonic_key) ? __tsonic_dict[__tsonic_key] : default;
                }))();
        }
    }
}
