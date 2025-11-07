using Tsonic.Runtime;

namespace TestCases.types
{
    public class Named
    {
        public string name { get; set; }
    }

    public class Aged
    {
        public double age { get; set; }
    }

    public class Serializable
    {
        public string toJSON() => throw new NotImplementedException();
    }

    public static class TuplesAndIntersections
    {
        // type Point2D = dynamic

        // type Point3D = dynamic

        // type NamedPoint = dynamic

        // type Coords = dynamic

        // type StringWithNumbers = dynamic

        // type Person = object

        // type SerializablePerson = object

        public static double distance(Point2D point)
            {
            var x = point[0];
            var y = point[1];
            return Tsonic.Runtime.Math.sqrt(x * x + y * y);
            }

        public static Point2D createPoint(double x, double y)
            {
            return new Tsonic.Runtime.Array<object>(x, y);
            }

        public static string greetPerson(Person person)
            {
            return $"{person.name} is {person.age} years old";
            }

        public static double sum(dynamic nums)
            {
            return nums.reduce((a, b) => a + b, 0.0);
            }
    }
}
