// Generated from: ArraySpread.ts
// Generated at: 2026-02-25T02:59:39.298Z
// WARNING: Do not modify this file manually

namespace TestCases.common.arrays.spread
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ArraySpread
    {
        public static double[] spreadArray(double[] arr1, double[] arr2)
        {
            return global::System.Linq.Enumerable.ToArray(global::System.Linq.Enumerable.Concat(arr1, arr2));
        }
    }
}