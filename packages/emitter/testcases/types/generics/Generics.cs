using Tsonic.Runtime;

namespace TestCases.types
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

        public static T? firstElement<T>(Tsonic.Runtime.Array<T> arr)
            {
            return arr[0];
            }
    }
}
