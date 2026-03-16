namespace TestCases.common.edgecases.objectliteraltypeparameter
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ObjectLiteralTypeParameter
    {
        public static T id<T>(T x)
        {
            return x;
        }

        public static readonly global::TestCases.common.edgecases.objectliteraltypeparameter.__Anon_9e4e_ca37654d value = id(new global::TestCases.common.edgecases.objectliteraltypeparameter.__Anon_9e4e_ca37654d { ok = true, nested = new global::TestCases.common.edgecases.objectliteraltypeparameter.__Anon_9e4e_96f94ff3 { x = 1 } });
    }
}
