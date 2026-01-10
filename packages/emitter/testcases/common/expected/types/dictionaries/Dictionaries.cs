namespace TestCases.common.types.dictionaries
{
        public static class Dictionaries
        {
            public static global::System.Collections.Generic.Dictionary<string, double> GetStringDict()
                {
                return new global::System.Collections.Generic.Dictionary<string, double>();
                }

            public static global::System.Collections.Generic.Dictionary<double, string> GetNumberDict()
                {
                return new global::System.Collections.Generic.Dictionary<double, string>();
                }

            // type NumberIndexed = global::System.Collections.Generic.Dictionary<double, string>

            public static string? LookupByNumber(global::System.Collections.Generic.Dictionary<double, string> dict, double key)
                {
                return dict[key];
                }
        }
}