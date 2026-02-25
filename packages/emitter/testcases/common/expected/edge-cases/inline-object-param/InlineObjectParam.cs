// Generated from: InlineObjectParam.ts
// Generated at: 2026-02-25T03:00:07.291Z
// WARNING: Do not modify this file manually

namespace TestCases.common.edgecases.inlineobjectparam
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class InlineObjectParam
    {
        public static int takes(global::TestCases.common.edgecases.inlineobjectparam.__Anon_d6a3_85ebdc21 x)
        {
            return x.a;
        }

        public static readonly int result;

        static InlineObjectParam()
        {
            result = takes(new global::TestCases.common.edgecases.inlineobjectparam.__Anon_d6a3_85ebdc21 { a = 1, b = "hi" });
        }
    }
}