using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

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

                public static T? firstElement<T>(List<T> arr)
                    {
                    return Tsonic.Runtime.Array.get(arr, 0);
                    }
            }
}