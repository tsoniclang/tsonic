namespace TestCases.common.types.expectedtypethreading
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class TernaryTyping
    {
        public static readonly int ternaryInt = true ? (int)5 : (int)10;

        public static readonly int nestedTernary = true ? false ? (int)1 : (int)2 : (int)3;

        public static int ternaryReturn(bool flag)
        {
            return flag ? (int)100 : (int)200;
        }
    }
}