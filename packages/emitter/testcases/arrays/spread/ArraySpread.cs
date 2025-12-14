// Generated from: ArraySpread.ts
// Generated at: 2025-12-13T16:22:31.332Z
// WARNING: Do not modify this file manually

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