// Generated from: GenericAliases.ts
// Generated at: 2026-02-25T03:00:49.918Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.functiontypealiases
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class GenericAliases
    {
        // type Predicate<T> = global::System.Func<T, bool>

        // type Transform<TT, U> = global::System.Func<TT, U>

        // type Comparer<T> = global::System.Func<T, T, int>

        public static bool test<TT>(TT value, global::System.Func<TT, bool> pred)
        {
            return pred(value);
        }

        public static TU transform<TT, TU>(TT value, global::System.Func<TT, TU> fn)
        {
            return fn(value);
        }

        public static int compare<TT>(TT a, TT b, global::System.Func<TT, TT, int> cmp)
        {
            return cmp(a, b);
        }
    }
}