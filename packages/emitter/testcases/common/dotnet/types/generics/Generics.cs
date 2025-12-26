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

                public static bool tryFirstElement<T>(global::System.Collections.Generic.List<T> arr, out T result)
                    {
                    result = default;

                    if (global::Tsonic.JSRuntime.Array.length(arr) == 0)
                        {
                        return false;
                        }
                    result = global::Tsonic.JSRuntime.Array.get(arr, 0);
                    return true;
                    }
            }
}