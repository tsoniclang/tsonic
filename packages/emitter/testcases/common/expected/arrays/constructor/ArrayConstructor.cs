namespace TestCases.common.arrays.constructor
{
    internal class User
    {
        public required string Name { get; set; }

        public required int Age { get; set; }
    }

            public static class ArrayConstructor
            {
                public static int[] CreateIntArray(int size)
                    {
                    return new int[size];
                    }

                public static string[] CreateStringArray(int size)
                    {
                    return new string[size];
                    }

                public static bool[] CreateBooleanArray(int size)
                    {
                    return new bool[size];
                    }

                public static double[] CreateDoubleArray(int size)
                    {
                    return new double[size];
                    }

                public static int[] CreateFixedArray()
                    {
                    return new int[10];
                    }

                public static int[] CreateEmptyArray()
                    {
                    return new int[0];
                    }

                public static string?[] CreateNullableArray(int size)
                    {
                    return new string?[size];
                    }

                public static int[] CreateDynamicArray(int count)
                    {
                    var size = count * 2;
                    return new int[size];
                    }

                public static int[] CreateExpressionSizeArray(int a, int b)
                    {
                    return new int[a + b];
                    }

                public static User[] CreateObjectArray(int size)
                    {
                    return new User[size];
                    }
            }
}