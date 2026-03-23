namespace TestCases.common.arrays.basic
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ArrayLiteral
    {
        public static int[] createArray()
        {
            var arr = new int[] { (int)1, (int)2, (int)3 };
            return arr;
        }
    }
}