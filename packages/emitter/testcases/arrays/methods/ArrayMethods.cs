using Tsonic.Runtime;
using System.Collections.Generic;

namespace TestCases.arrays
{
    public static class ArrayMethods
    {
        public static double processArray(List<double> arr)
            {
            var doubled = Tsonic.Runtime.Array.map(arr, (x) => x * 2.0);
            var filtered = Tsonic.Runtime.Array.filter(doubled, (x) => x > 5.0);
            var sum = Tsonic.Runtime.Array.reduce(filtered, (acc, x) => acc + x, 0.0);
            return sum;
            }
    }
}
