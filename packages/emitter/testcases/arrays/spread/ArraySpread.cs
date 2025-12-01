namespace TestCases.arrays.spread
{
        public static class ArraySpread
        {
            public static global::System.Collections.Generic.List<double> spreadArray(global::System.Collections.Generic.List<double> arr1, global::System.Collections.Generic.List<double> arr2)
                {
                return global::System.Linq.Enumerable.ToList(global::System.Linq.Enumerable.Concat(arr1, arr2));
                }
        }
}