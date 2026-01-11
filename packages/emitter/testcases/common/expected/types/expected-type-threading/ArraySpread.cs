namespace TestCases.common.types.expectedtypethreading
{
        public static class ArraySpread
        {
            private static readonly int[] Source = new int[] { 1, 2, 3 };

            public static readonly int[] WithSpread = new int[] { /* ...spread */, 4, 5 };

            private static readonly int[] More = new int[] { 10, 20 };

            public static readonly int[] MultiSpread = new int[] { /* ...spread */, /* ...spread */, 100 };
        }
}