// Generated from: ArrayConstructor.ts
// Generated at: 2026-01-17T15:36:30.592Z
// WARNING: Do not modify this file manually

namespace TestCases.common.arrays.constructor
{
    internal class User
    {
        public required string name { get; set; }

        public required int age { get; set; }
    }

            public static class ArrayConstructor
            {
                public static int[] createIntArray(int size)
                    {
                    return new int[size];
                    }

                public static string[] createStringArray(int size)
                    {
                    return new string[size];
                    }

                public static bool[] createBooleanArray(int size)
                    {
                    return new bool[size];
                    }

                public static double[] createDoubleArray(int size)
                    {
                    return new double[size];
                    }

                public static int[] createFixedArray()
                    {
                    return new int[10];
                    }

                public static int[] createEmptyArray()
                    {
                    return new int[0];
                    }

                public static string?[] createNullableArray(int size)
                    {
                    return new string?[size];
                    }

                public static int[] createDynamicArray(int count)
                    {
                    var size = count * 2;
                    return new int[size];
                    }

                public static int[] createExpressionSizeArray(int a, int b)
                    {
                    return new int[a + b];
                    }

                public static User[] createObjectArray(int size)
                    {
                    return new User[size];
                    }
            }
}