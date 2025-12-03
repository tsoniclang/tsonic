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
                return new global::System.Collections.Generic.List<global::System.Collections.Generic.List<double>> { new global::System.Collections.Generic.List<double> { 1.0, 2.0 }, new global::System.Collections.Generic.List<double> { 3.0, 4.0 } };
                }
        }
}