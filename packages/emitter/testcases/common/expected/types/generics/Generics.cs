namespace TestCases.common.types.generics
{
    public class Box<T>
    {
        public T value { get; set; }

        public Box(T value)
            {
            this.value = value;
            }

        public T getValue()
            {
            return this.value;
            }
    }

            [global::Tsonic.Internal.ModuleContainerAttribute]
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