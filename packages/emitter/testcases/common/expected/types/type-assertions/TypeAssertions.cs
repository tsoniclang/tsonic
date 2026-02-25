// Generated from: TypeAssertions.ts
// Generated at: 2026-02-25T03:01:03.900Z
// WARNING: Do not modify this file manually

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
    public static readonly int intFromLiteral;

    public static readonly byte byteFromLiteral;

    public static readonly short shortFromLiteral;

    public static readonly long longFromLiteral;

    public static readonly float floatFromLiteral;

    public static readonly double doubleFromLiteral;

    public static readonly object someObject;

    public static readonly Animal asAnimal;

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

    static TypeAssertions()
    {
        intFromLiteral = 1000;
        byteFromLiteral = 255;
        shortFromLiteral = 1000;
        longFromLiteral = 1000000L;
        floatFromLiteral = 1.5f;
        doubleFromLiteral = 1.5;
        someObject = new Dog();
        asAnimal = (Animal)someObject;
    }
}
}