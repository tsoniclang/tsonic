// Generated from: GenericAliases.ts
// Generated at: 2026-01-17T15:37:30.561Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.functiontypealiases
{
        public static class GenericAliases
        {
            // type Predicate = global::System.Func<T, bool>

            // type Transform = global::System.Func<T, U>

            // type Comparer = global::System.Func<T, T, int>

            public static bool test<T>(T value, global::System.Func<T, bool> pred)
                {
                return pred(value);
                }

            public static U transform<T, U>(T value, global::System.Func<T, U> fn)
                {
                return fn(value);
                }

            public static int compare<T>(T a, T b, global::System.Func<T, T, int> cmp)
                {
                return cmp(a, b);
                }
        }
}