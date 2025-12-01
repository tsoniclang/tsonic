namespace TestCases.types.tuplesintersections
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
        public string toJSON() => throw new global::System.NotImplementedException();
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
                    var x = global::Tsonic.Runtime.Array.get(point, 0.0);
                    var y = global::Tsonic.Runtime.Array.get(point, 1.0);
                    return global::Tsonic.JSRuntime.Math.sqrt(x * x + y * y);
                    }

                public static Point2D createPoint(double x, double y)
                    {
                    return new global::System.Collections.Generic.List<object> { x, y };
                    }

                public static string greetPerson(Person person)
                    {
                    return $"{person.name} is {person.age} years old";
                    }

                public static double sum(dynamic nums)
                    {
                    return global::Tsonic.JSRuntime.Array.reduce(nums, (a, b) => a + b, 0);
                    }
            }
}
