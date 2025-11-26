using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.arrays.destructuring
{
        public static class ArrayDestructure
        {
            public static double destructure(List<double> arr)
                {
                var first = Tsonic.Runtime.Array.get(arr, 0.0);
                var second = Tsonic.Runtime.Array.get(arr, 1.0);
                return first + second;
                }
        }
}