namespace TestCases.common.types.functiontypealiases
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class GenericAliases
    {
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