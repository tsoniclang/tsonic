namespace TestCases.common.types.typeassertions
{
    internal class Animal
    {
        public string Name;
    }
    internal class Dog : Animal
    {
        public string Breed;
    }

            public static class TypeAssertions
            {
                public static readonly int IntFromLiteral = 1000;

                public static readonly byte ByteFromLiteral = 255;

                public static readonly short ShortFromLiteral = 1000;

                public static readonly long LongFromLiteral = 1000000L;

                public static readonly float FloatFromLiteral = 1.5f;

                public static readonly double DoubleFromLiteral = 1.5;

                public static readonly object SomeObject = new Dog();

                public static readonly Animal AsAnimal = (Animal)SomeObject;

                public static Animal TestReferenceCasts(object obj)
                    {
                    var animal = (Animal)obj;
                    return animal;
                    }

                public static Dog TestDownCast(Animal animal)
                    {
                    var dog = (Dog)animal;
                    return dog;
                    }
            }
}