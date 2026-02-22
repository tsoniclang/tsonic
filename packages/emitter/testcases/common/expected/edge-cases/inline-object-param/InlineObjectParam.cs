namespace TestCases.common.edgecases.inlineobjectparam
{
        [global::Tsonic.Internal.ModuleContainerAttribute]
        public static class InlineObjectParam
        {
            public static int takes(global::TestCases.common.edgecases.inlineobjectparam.__Anon_d6a3_85ebdc21 x)
                {
                return x.a;
                }

            public static readonly int result = takes(new global::TestCases.common.edgecases.inlineobjectparam.__Anon_d6a3_85ebdc21 { a = 1, b = "hi" });
        }
}