namespace TestCases.functions.typeguards
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
                // type Animal = global::Tsonic.Runtime.Union<Dog, Cat>

                public static bool isDog(Animal animal)
                    {
                    return animal.type == "dog";
                    }

                public static bool isCat(Animal animal)
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

                public static string processValue(global::Tsonic.Runtime.Union<string, double> value)
                    {
                    if (global::Tsonic.Runtime.Operators.@typeof(value) == "string")
                        {
                        return global::Tsonic.JSRuntime.String.toUpperCase(value);
                        }
                    return global::Tsonic.JSRuntime.Number.toString(value);
                    }

                public static double getArea(global::Tsonic.Runtime.Union<Circle, double> shape)
                    {
                    if (shape is Circle)
                        {
                        return global::Tsonic.JSRuntime.Math.PI * shape.radius * shape.radius;
                        }
                    return shape;
                    }
            }
}