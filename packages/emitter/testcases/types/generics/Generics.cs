namespace TestCases.types.generics
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

                public static T? firstElement<T>(global::System.Collections.Generic.List<T> arr)
                    {
                    return global::Tsonic.JSRuntime.Array.get(arr, 0);
                    }
            }
}