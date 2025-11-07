using Tsonic.Runtime;

namespace TestCases.functions
{
    public class Dog
    {
        public string type { get; set; }

        public void bark() => throw new NotImplementedException();
    }

    public class Cat
    {
        public string type { get; set; }

        public void meow() => throw new NotImplementedException();
    }

    public class Circle
    {
        public double radius;

        public Circle(double radius)
            {
            this.radius = radius;
            }
    }

    public static class TypeGuards
    {
        // type Animal = Union<Dog, Cat>

        public static dynamic isDog(Animal animal)
            {
            return animal.type == "dog";
            }

        public static dynamic isCat(Animal animal)
            {
            return animal.type == "cat";
            }

        public static void makeSound(Animal animal)
            {
            if (isDog(animal))
                {
                animal.bark();
                }
            else
                if (isCat(animal))
                    {
                    animal.meow();
                    }
            }

        public static string processValue(Union<string, double> value)
            {
            if (Tsonic.Runtime.Operators.@typeof(value) == "string")
                {
                return Tsonic.Runtime.String.toUpperCase(value);
                }
            return Tsonic.Runtime.Number.toString(value);
            }

        public static double getArea(Union<Circle, double> shape)
            {
            if (shape is Circle)
                {
                return Tsonic.Runtime.Math.PI * shape.radius * shape.radius;
                }
            return shape;
            }
    }
}
