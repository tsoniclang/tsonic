namespace TestCases.common.edgecases.inlineobjectparam
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class InlineObjectParam
    {
        public static int takes(global::TestCases.common.edgecases.inlineobjectparam.__Anon_d6a3_aaa895b9 x)
        {
            return x.a;
        }

        public static readonly int result = takes(new global::TestCases.common.edgecases.inlineobjectparam.__Anon_d6a3_aaa895b9 { a = (int)1, b = "hi" });
    }
}