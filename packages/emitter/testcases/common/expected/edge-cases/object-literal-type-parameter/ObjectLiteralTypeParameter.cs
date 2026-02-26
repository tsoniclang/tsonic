namespace TestCases.common.edgecases.objectliteraltypeparameter
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ObjectLiteralTypeParameter
    {
        public static T id<T>(T x)
        {
            return x;
        }

        public static readonly global::TestCases.common.edgecases.objectliteraltypeparameter.__Anon_9e4e_dfed8c8d value = id(new global::TestCases.common.edgecases.objectliteraltypeparameter.__Anon_9e4e_dfed8c8d { ok = true, nested = new global::TestCases.common.edgecases.objectliteraltypeparameter.__Anon_9e4e_26920d55 { x = 1 } });
    }
}