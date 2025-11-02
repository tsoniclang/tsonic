using Tsonic.Runtime;

namespace TestCases.arrays
{
    public static class ArrayMethods
    {
        public static double processArray(Tsonic.Runtime.Array<double> arr)
            {
            var doubled = arr.Map((x) => x * 2.0);
            var filtered = doubled.Filter((x) => x > 5.0);
            var sum = filtered.Reduce((acc, x) => acc + x, 0.0);
            return sum;
            }
    }
}
