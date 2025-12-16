namespace TestCases.jsonly.types.tuplesbasic
{
    public class Container <T>
    {
        public T value { get; set; }
    }

            public static class BasicTuples
            {
                // type Point2D = global::System.ValueTuple<double, double>

                // type Point3D = global::System.ValueTuple<double, double, double>

                // type NamedPoint = global::System.ValueTuple<double, double>

                // type StringPair = global::System.ValueTuple<string, string>

                // type MixedTuple = global::System.ValueTuple<string, double, bool>

                // type NumberArray = global::System.Collections.Generic.List<double>

                public static global::System.ValueTuple<double, double> createPoint(double x, double y)
                    {
                    return (x, y);
                    }

                public static global::System.ValueTuple<double, double, double> create3DPoint(double x, double y, double z)
                    {
                    return (x, y, z);
                    }

                public static global::System.ValueTuple<string, double, bool> createMixed()
                    {
                    return ("hello", 42, true);
                    }

                public static double distance(global::System.ValueTuple<double, double> point)
                    {
                    var x = global::Tsonic.JSRuntime.Array.get(point, 0);
                    var y = global::Tsonic.JSRuntime.Array.get(point, 1);
                    return global::Tsonic.JSRuntime.Math.Sqrt(x * x + y * y);
                    }

                public static Container<global::System.ValueTuple<double, double>> wrapPoint(global::System.ValueTuple<double, double> point)
                    {
                    return new Container<global::System.ValueTuple<double, double>> { value = point };
                    }
            }
}