// Generated from: TernaryTyping.ts
// Generated at: 2026-01-17T15:37:22.498Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.expectedtypethreading
{
        public static class TernaryTyping
        {
            public static readonly int ternaryInt = true ? 5 : 10;

            public static readonly int nestedTernary = true ? false ? 1 : 2 : 3;

            public static int ternaryReturn(bool flag)
                {
                return flag ? 100 : 200;
                }
        }
}