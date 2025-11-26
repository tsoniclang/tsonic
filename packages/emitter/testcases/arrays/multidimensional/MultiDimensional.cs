using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.arrays.multidimensional
{
        public static class MultiDimensional
        {
            public static double getElement(List<List<double>> matrix)
                {
                return Tsonic.Runtime.Array.get(Tsonic.Runtime.Array.get(matrix, 0), 1);
                }

            public static List<List<double>> createMatrix()
                {
                return new List<List<double>> { new List<int> { 1, 2 }, new List<int> { 3, 4 } };
                }
        }
}