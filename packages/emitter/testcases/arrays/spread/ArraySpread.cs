using Tsonic.Runtime;
using System.Collections.Generic;
using System.Linq;

namespace TestCases.arrays
{
    public static class ArraySpread
    {
        public static List<double> spreadArray(List<double> arr1, List<double> arr2)
            {
            return arr1.Concat(arr2).ToList();
            }
    }
}
