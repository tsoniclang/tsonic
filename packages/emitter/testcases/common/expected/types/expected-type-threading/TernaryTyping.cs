namespace TestCases.common.types.expectedtypethreading
{
        public static class TernaryTyping
        {
            public static readonly int TernaryInt = true ? 5 : 10;

            public static readonly int NestedTernary = true ? false ? 1 : 2 : 3;

            public static int TernaryReturn(bool flag)
                {
                return flag ? 100 : 200;
                }
        }
}