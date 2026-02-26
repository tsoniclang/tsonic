namespace TestCases.common.types.typeassertions
{
    public class Animal
    {
        public string name { get; set; }
    }

    public class Dog : Animal
    {
        public string breed { get; set; }
    }

    [global::Tsonic.Internal.ModuleContainerAttribute]
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