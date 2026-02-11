namespace TestCases.common.arrays.basic
{
        [global::Tsonic.Internal.ModuleContainerAttribute]
        public static class ArrayLiteral
        {
            public static int[] createArray()
                {
                var arr = new int[] { 1, 2, 3 };
                return arr;
                }
        }
}