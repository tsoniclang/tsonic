namespace TestCases.common.arrays.multidimensional
{
        public static class MultiDimensional
        {
            public static double GetElement(double[][] matrix)
                {
                return matrix[0][1];
                }

            public static double[][] CreateMatrix()
                {
                return new double[][] { new double[] { 1, 2 }, new double[] { 3, 4 } };
                }
        }
}