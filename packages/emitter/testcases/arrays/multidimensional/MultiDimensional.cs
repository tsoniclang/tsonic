// Generated from: MultiDimensional.ts
// Generated at: 2025-12-13T16:22:31.325Z
// WARNING: Do not modify this file manually

namespace TestCases.arrays.multidimensional
{
        public static class MultiDimensional
        {
            public static double getElement(global::System.Collections.Generic.List<global::System.Collections.Generic.List<double>> matrix)
                {
                return global::Tsonic.JSRuntime.Array.get(global::Tsonic.JSRuntime.Array.get(matrix, 0), 1);
                }

            public static global::System.Collections.Generic.List<global::System.Collections.Generic.List<double>> createMatrix()
                {
                return new global::System.Collections.Generic.List<global::System.Collections.Generic.List<double>> { new global::System.Collections.Generic.List<int> { 1, 2 }, new global::System.Collections.Generic.List<int> { 3, 4 } };
                }
        }
}