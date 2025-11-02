using Tsonic.Runtime;

namespace TestCases.arrays
{
    public static class ArrayMethods
    {
        public static double processArray(Tsonic.Runtime.Array<double> arr)
            {
            var doubled = arr.map((x) => x * 2.0);
            var filtered = doubled.filter((x) => x > 5.0);
            var sum = filtered.reduce((acc, x) => acc + x, 0.0);
            return sum;
            }
    }
}
