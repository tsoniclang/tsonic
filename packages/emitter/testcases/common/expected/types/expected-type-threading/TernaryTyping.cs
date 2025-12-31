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
