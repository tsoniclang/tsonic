namespace TestCases.arrays.destructuring
{
        public static class ArrayDestructure
        {
            public static double destructure(global::System.Collections.Generic.List<double> arr)
                {
                var first = global::Tsonic.Runtime.Array.get(arr, 0.0);
                var second = global::Tsonic.Runtime.Array.get(arr, 1.0);
                return first + second;
                }
        }
}