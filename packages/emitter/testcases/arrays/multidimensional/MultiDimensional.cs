using Tsonic.Runtime;
using System.Collections.Generic;

namespace TestCases.arrays
{
    public static class MultiDimensional
    {
        public static double getElement(List<List<double>> matrix)
            {
            return Tsonic.Runtime.Array.get(Tsonic.Runtime.Array.get(matrix, 0), 1);
            }

        public static List<List<double>> createMatrix()
            {
            return new List<object> { new List<object> { 1.0, 2.0 }, new List<object> { 3.0, 4.0 } };
            }
    }
}
