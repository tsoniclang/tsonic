using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.realworld.shapes
{
    public class Shape
    {
        public string color;

        public Shape(string color)
            {
            this.color = color;
            }

        public double area();

        public double perimeter();

        public string describe()
            {
            return $"A {this.color} shape with area {this.area()} and perimeter {this.perimeter()}";
            }
    }
    public class Circle : Shape
    {
        public double radius;

        // ERROR: super() must be the first statement in constructor
        public Circle(string color, double radius)
        {
            // Constructor body omitted due to error
        }

        public override double area()
            {
            return Tsonic.JSRuntime.Math.PI * this.radius * this.radius;
            }

        public override double perimeter()
            {
            return 2 * Tsonic.JSRuntime.Math.PI * this.radius;
            }
    }
    public class Rectangle : Shape
    {
        public double width;

        public double height;

        // ERROR: super() must be the first statement in constructor
        public Rectangle(string color, double width, double height)
        {
            // Constructor body omitted due to error
        }

        public override double area()
            {
            return this.width * this.height;
            }

        public override double perimeter()
            {
            return 2 * this.width + this.height;
            }

        public bool isSquare()
            {
            return this.width == this.height;
            }
    }
    public class Triangle : Shape
    {
        public double base;

        public double height;

        public double side1;

        public double side2;

        // ERROR: super() must be the first statement in constructor
        public Triangle(string color, double base, double height, double side1, double side2)
        {
            // Constructor body omitted due to error
        }

        public override double area()
            {
            return this.base * this.height / 2;
            }

        public override double perimeter()
            {
            return this.base + this.side1 + this.side2;
            }
    }

            public static class shapes
            {
                public static double totalArea(List<Shape> shapes)
                    {
                    return Tsonic.JSRuntime.Array.reduce(shapes, (sum, shape) => sum + shape.area(), 0);
                    }

                public static Shape? findLargestShape(List<Shape> shapes)
                    {
                    if (Tsonic.Runtime.Array.length(shapes) == 0)
                        {
                        return default;
                        }
                    var largest = Tsonic.Runtime.Array.get(shapes, 0);
                    foreach (var shape in shapes)
                        {
                        if (shape.area() > largest.area())
                            {
                            largest = shape;
                            }
                        }
                    return largest;
                    }
            }
}