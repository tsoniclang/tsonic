namespace TestCases.common.types.generics
{
    public class Box<T>
    {
        public T Value;

        public Box(T value)
            {
            this.Value = value;
            }

        public T GetValue()
            {
            return this.Value;
            }
    }

            public static class Generics
            {
                public static T Identity<T>(T value)
                    {
                    return value;
                    }

                public static bool TryFirstElement<T>(T[] arr, out T result)
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