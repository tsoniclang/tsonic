namespace TestCases.common.edgecases.objectliteraltypeparameter
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ObjectLiteralTypeParameter
    {
        public static T id<T>(T x)
        {
            return x;
        }

        public static readonly global::TestCases.common.edgecases.objectliteraltypeparameter.__Anon_9e4e_a6451321 value = id(new global::TestCases.common.edgecases.objectliteraltypeparameter.__Anon_9e4e_a6451321 { ok = true, nested = new global::TestCases.common.edgecases.objectliteraltypeparameter.__Anon_9e4e_dc1c40a8 { x = 1 } });
    }
}
