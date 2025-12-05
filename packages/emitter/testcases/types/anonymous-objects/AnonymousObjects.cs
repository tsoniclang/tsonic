namespace TestCases.types.anonymousobjects
{
    public class __Anon_AnonymousObjects_2_22
    {
        public double x { get; set; }

        public double y { get; set; }
    }
    public class __Anon_AnonymousObjects_5_23
    {
        public double count { get; set; }

        public bool enabled { get; set; }

        public string name { get; set; }
    }
    public class __Anon_AnonymousObjects_12_24
    {
        public double id { get; set; }

        public global::System.Func<double, double> process { get; set; }
    }
    public class __Anon_AnonymousObjects_19_26
    {
        public double value { get; set; }
    }

            public static class AnonymousObjects
            {
                public static readonly var point = new __Anon_AnonymousObjects_2_22 { x = 10.0, y = 20.0 };

                public static readonly var config = new __Anon_AnonymousObjects_5_23 { name = "test", count = 42.0, enabled = true };

                public static readonly var handler = new __Anon_AnonymousObjects_12_24 { id = 1.0, process = (double x) => x * 2.0 };

                var value = 100.0;

                public static readonly var shorthand = new __Anon_AnonymousObjects_19_26 { value = value };
            }
}