using Tsonic.Runtime;

namespace TestCases.arrays
{
    public static class ArraySpread
    {
        public static Tsonic.Runtime.Array<double> spreadArray(Tsonic.Runtime.Array<double> arr1, Tsonic.Runtime.Array<double> arr2)
            {
            return arr1.Concat(arr2);
            }
    }
}
