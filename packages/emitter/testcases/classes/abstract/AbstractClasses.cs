namespace TestCases.classes.abstract
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
            return 2.0 * (this.width + this.height);
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
            return global::Tsonic.JSRuntime.Math.PI * this.radius * this.radius;
            }

        public override double getPerimeter()
            {
            return 2.0 * global::Tsonic.JSRuntime.Math.PI * this.radius;
            }
    }

            public static class AbstractClasses
            {
                public static double calculateTotalArea(global::System.Collections.Generic.List<Shape> shapes)
                    {
                    return global::Tsonic.JSRuntime.Array.reduce(shapes, (double total, Shape shape) => total + shape.getArea(), 0.0);
                    }
            }
}