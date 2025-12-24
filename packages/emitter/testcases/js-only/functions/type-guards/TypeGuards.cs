namespace TestCases.jsonly.functions.typeguards
{
    public class Dog
    {
        public required string type { get; set; }

        public void bark() => throw new NotImplementedException();
    }
    public class Cat
    {
        public required string type { get; set; }

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
                    return animal.Match(__m1 => __m1.type, __m2 => __m2.type) == "dog";
                    }

                public static bool isCat(Animal animal)
                    {
                    return animal.Match(__m1 => __m1.type, __m2 => __m2.type) == "cat";
                    }

                public static void makeSound(Animal animal)
                    {
                    if (animal.Is1())
                    {
                        var animal__1_1 = animal.As1();
                        animal__1_1.bark();
                    }
                    else
                        if (animal.Is2())
                        {
                            var animal__2_2 = animal.As2();
                            animal__2_2.meow();
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