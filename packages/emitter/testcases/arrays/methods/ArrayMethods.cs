namespace TestCases.arrays.methods
{
        public static class ArrayMethods
        {
            public static double processArray(global::System.Collections.Generic.List<double> arr)
                {
                var doubled = global::Tsonic.JSRuntime.Array.map(arr, (x) => x * 2.0);
                var filtered = global::Tsonic.JSRuntime.Array.filter(doubled, (x) => x > 5.0);
                var sum = global::Tsonic.JSRuntime.Array.reduce(filtered, (acc, x) => acc + x, 0.0);
                return sum;
                }
        }
}