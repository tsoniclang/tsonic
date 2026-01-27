namespace TestCases.common.arrays.spread
{
        public static class ArraySpread
        {
            public static double[] spreadArray(double[] arr1, double[] arr2)
                {
                return global::System.Linq.Enumerable.ToArray(global::System.Linq.Enumerable.Concat(arr1, arr2));
                }
        }
}