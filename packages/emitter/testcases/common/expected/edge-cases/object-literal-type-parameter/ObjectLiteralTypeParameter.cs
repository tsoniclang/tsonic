namespace TestCases.common.edgecases.objectliteraltypeparameter
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ObjectLiteralTypeParameter
    {
        public static T id<T>(T x)
        {
            return x;
        }

        public static readonly global::TestCases.common.edgecases.objectliteraltypeparameter.__Anon_9e4e_efadf612 value = id(new global::TestCases.common.edgecases.objectliteraltypeparameter.__Anon_9e4e_efadf612 { ok = true, nested = new global::TestCases.common.edgecases.objectliteraltypeparameter.__Anon_9e4e_3f41291e { x = 1 } });
    }
}
