// Generated from: TernaryTyping.ts
// Generated at: 2026-02-25T03:00:41.084Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.expectedtypethreading
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class TernaryTyping
    {
        public static readonly int ternaryInt;

        public static readonly int nestedTernary;

        public static int ternaryReturn(bool flag)
        {
            return flag ? 100 : 200;
        }

        static TernaryTyping()
        {
            ternaryInt = true ? 5 : 10;
            nestedTernary = true ? false ? 1 : 2 : 3;
        }
    }
}