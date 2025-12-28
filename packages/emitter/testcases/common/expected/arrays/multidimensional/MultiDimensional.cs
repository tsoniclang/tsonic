namespace TestCases.common.arrays.multidimensional
{
        public static class MultiDimensional
        {
            public static double getElement(double[][] matrix)
                {
                return matrix[0][1];
                }

            public static double[][] createMatrix()
                {
                return new[] { new[] { 1, 2 }, new[] { 3, 4 } };
                }
        }
}