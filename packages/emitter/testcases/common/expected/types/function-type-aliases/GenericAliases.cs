namespace TestCases.common.types.functiontypealiases
{
        public static class GenericAliases
        {
            // type Predicate = global::System.Func<T, bool>

            // type Transform = global::System.Func<T, U>

            // type Comparer = global::System.Func<T, T, int>

            public static bool Test<T>(T value, global::System.Func<T, bool> pred)
                {
                return pred(value);
                }

            public static U Transform<T, U>(T value, global::System.Func<T, U> fn)
                {
                return fn(value);
                }

            public static int Compare<T>(T a, T b, global::System.Func<T, T, int> cmp)
                {
                return cmp(a, b);
                }
        }
}