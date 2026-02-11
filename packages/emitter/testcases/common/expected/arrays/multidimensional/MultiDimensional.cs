namespace TestCases.common.arrays.multidimensional
{
        [global::Tsonic.Internal.ModuleContainerAttribute]
        public static class MultiDimensional
        {
            public static double getElement(double[][] matrix)
                {
                return matrix[0][1];
                }

            public static double[][] createMatrix()
                {
                return new double[][] { new double[] { 1, 2 }, new double[] { 3, 4 } };
                }
        }
}