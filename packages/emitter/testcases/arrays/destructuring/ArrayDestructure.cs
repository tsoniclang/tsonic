// Generated from: ArrayDestructure.ts
// Generated at: 2025-12-13T16:22:31.293Z
// WARNING: Do not modify this file manually

namespace TestCases.arrays.destructuring
{
        public static class ArrayDestructure
        {
            public static double destructure(global::System.Collections.Generic.List<double> arr)
                {
                var first = global::Tsonic.JSRuntime.Array.get(arr, 0);
                var second = global::Tsonic.JSRuntime.Array.get(arr, 1);
                return first + second;
                }
        }
}