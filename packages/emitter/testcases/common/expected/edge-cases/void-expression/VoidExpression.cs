namespace TestCases.common.edgecases.voidexpression
{
        [global::Tsonic.Internal.ModuleContainerAttribute]
        public static class VoidExpression
        {
            public static void voidStatementMarker()
                {
                int x = 1;
                _ = x;
                }

            public static void voidReturnInVoidFunc()
                {
                sideEffect();
                return;
                }

            public static object? voidReturnValue()
                {
                return ((global::System.Func<object?>)(() => { sideEffect(); return default(object?); }))();
                }

            internal static int sideEffect()
                {
                return 42;
                }
        }
}