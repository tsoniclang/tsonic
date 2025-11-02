using Tsonic.Runtime;

namespace TestCases.arrays
{
    public static class ArrayDestructure
    {
        public static double destructure(Tsonic.Runtime.Array<double> arr)
            {
            var first = arr[0];
            var second = arr[1];
            return first + second;
            }
    }
}
