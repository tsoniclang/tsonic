namespace TestCases.common.edgecases.objectliteraltypeparameter
{
    public class __Anon_ObjectLiteralTypeParameter_5_45
    {
        public required int x { get; set; }
    }
    public class __Anon_ObjectLiteralTypeParameter_5_25
    {
        public required bool ok { get; set; }

        public required __Anon_ObjectLiteralTypeParameter_5_45 nested { get; set; }
    }

            [global::Tsonic.Internal.ModuleContainerAttribute]
            public static class ObjectLiteralTypeParameter
            {
                public static T id<T>(T x)
                    {
                    return x;
                    }

                public static readonly __Anon_ObjectLiteralTypeParameter_5_25 value = id(new __Anon_ObjectLiteralTypeParameter_5_25 { ok = true, nested = new __Anon_ObjectLiteralTypeParameter_5_45 { x = 1 } });
            }
}
