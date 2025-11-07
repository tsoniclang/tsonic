using Tsonic.Runtime;

namespace TestCases.classes
{
    public class Shape
    {
        public double getArea();

        public double getPerimeter();

        public string describe()
            {
            return $"Area: {this.getArea()}, Perimeter: {this.getPerimeter()}";
            }
    }

    public class Rectangle : Shape
    {
        public double width;

        public double height;

        public Rectangle(double width, double height) : base()
            {
            this.width = width;
            this.height = height;
            }

        public override double getArea()
            {
            return this.width * this.height;
            }

        public override double getPerimeter()
            {
            return 2.0 * this.width + this.height;
            }
    }

    public class Circle : Shape
    {
        public double radius;

        public Circle(double radius) : base()
            {
            this.radius = radius;
            }

        public override double getArea()
            {
            return Tsonic.Runtime.Math.PI * this.radius * this.radius;
            }

        public override double getPerimeter()
            {
            return 2.0 * Tsonic.Runtime.Math.PI * this.radius;
            }
    }

    public static class AbstractClasses
    {
        public static double calculateTotalArea(Tsonic.Runtime.Array<Shape> shapes)
            {
            return shapes.reduce((total, shape) => total + shape.getArea(), 0.0);
            }
    }
}
