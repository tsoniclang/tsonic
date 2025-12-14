// Generated from: ArrayMethods.ts
// Generated at: 2025-12-13T16:22:31.317Z
// WARNING: Do not modify this file manually

namespace TestCases.arrays.methods
{
        public static class ArrayMethods
        {
            public static double processArray(global::System.Collections.Generic.List<double> arr)
                {
                var doubled = global::Tsonic.JSRuntime.Array.map(arr, (double x) => x * 2);
                var filtered = global::Tsonic.JSRuntime.Array.filter(doubled, (double x) => x > 5);
                var sum = global::Tsonic.JSRuntime.Array.reduce(filtered, (double acc, double x) => acc + x, 0);
                return sum;
                }
        }
}