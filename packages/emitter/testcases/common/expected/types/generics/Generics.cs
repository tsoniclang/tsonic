// Generated from: Generics.ts
// Generated at: 2026-01-17T15:37:38.661Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.generics
{
    public class Box<T>
    {
        public T value;

        public Box(T value)
            {
            this.value = value;
            }

        public T getValue()
            {
            return this.value;
            }
    }

            public static class Generics
            {
                public static T identity<T>(T value)
                    {
                    return value;
                    }

                public static bool tryFirstElement<T>(T[] arr, out T result)
                    {
                    result = default;

                    if (arr.Length == 0)
                        {
                        return false;
                        }
                    result = arr[0];
                    return true;
                    }
            }
}