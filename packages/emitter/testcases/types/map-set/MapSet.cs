namespace TestCases.types.mapset
{
        public static class MapSet
        {
            public static global::Tsonic.JSRuntime.Map<string, double> createStringMap()
                {
                return new global::Tsonic.JSRuntime.Map<string, double>();
                }

            public static global::Tsonic.JSRuntime.Set<double> createNumberSet()
                {
                return new global::Tsonic.JSRuntime.Set<double>();
                }

            public static double useMap(global::Tsonic.JSRuntime.Map<string, double> map)
                {
                map.set("a", 1.0);
                map.set("b", 2.0);
                var value = map.get("a");
                var hasKey = map.has("a");
                var deleted = map.delete("b");
                var size = map.size;
                return value ?? 0.0;
                }

            public static bool useSet(global::Tsonic.JSRuntime.Set<string> set)
                {
                set.add("hello");
                set.add("world");
                var hasValue = set.has("hello");
                var deleted = set.delete("world");
                var size = set.size;
                return hasValue;
                }
        }
}