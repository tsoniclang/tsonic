namespace TestCases.common.types.anonymousobjects
{
    public class __Anon_AnonymousObjects_2_22
    {
        public required int x { get; set; }

        public required int y { get; set; }
    }
    public class __Anon_AnonymousObjects_5_23
    {
        public required string name { get; set; }

        public required int count { get; set; }

        public required bool enabled { get; set; }
    }
    public class __Anon_AnonymousObjects_12_24
    {
        public required int id { get; set; }

        public required global::System.Func<double, double> process { get; set; }
    }
    public class __Anon_AnonymousObjects_19_26
    {
        public required double value { get; set; }
    }

            public static class AnonymousObjects
            {
                public static readonly __Anon_AnonymousObjects_2_22 point = new __Anon_AnonymousObjects_2_22 { x = 10, y = 20 };

                public static readonly __Anon_AnonymousObjects_5_23 config = new __Anon_AnonymousObjects_5_23 { name = "test", count = 42, enabled = true };

                public static readonly __Anon_AnonymousObjects_12_24 handler = new __Anon_AnonymousObjects_12_24 { id = 1, process = (double x) => x * 2 };

                private static readonly int value = 100;

                public static readonly __Anon_AnonymousObjects_19_26 shorthand = new __Anon_AnonymousObjects_19_26 { value = value };
            }
}