// Generated from: TypeAssertions.ts
// Generated at: 2026-01-17T15:37:43.284Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.typeassertions
{
    internal class Animal
    {
        public string name;
    }
    internal class Dog : Animal
    {
        public string breed;
    }

            public static class TypeAssertions
            {
                public static readonly int intFromLiteral = 1000;

                public static readonly byte byteFromLiteral = 255;

                public static readonly short shortFromLiteral = 1000;

                public static readonly long longFromLiteral = 1000000L;

                public static readonly float floatFromLiteral = 1.5f;

                public static readonly double doubleFromLiteral = 1.5;

                public static readonly object someObject = new Dog();

                public static readonly Animal asAnimal = (Animal)someObject;

                public static Animal testReferenceCasts(object obj)
                    {
                    var animal = (Animal)obj;
                    return animal;
                    }

                public static Dog testDownCast(Animal animal)
                    {
                    var dog = (Dog)animal;
                    return dog;
                    }
            }
}