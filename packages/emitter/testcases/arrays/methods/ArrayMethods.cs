using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.arrays.methods
{
        public static class ArrayMethods
        {
            public static double processArray(List<double> arr)
                {
                var doubled = Tsonic.JSRuntime.Array.map(arr, (x) => x * 2);
                var filtered = Tsonic.JSRuntime.Array.filter(doubled, (x) => x > 5);
                var sum = Tsonic.JSRuntime.Array.reduce(filtered, (acc, x) => acc + x, 0);
                return sum;
                }
        }
}