namespace TestCases.common.types.anonymousobjects
{
    public class __Anon_AnonymousObjects_2_22
    {
        public required int X { get; set; }

        public required int Y { get; set; }
    }
    public class __Anon_AnonymousObjects_5_23
    {
        public required string Name { get; set; }

        public required int Count { get; set; }

        public required bool Enabled { get; set; }
    }
    public class __Anon_AnonymousObjects_12_24
    {
        public required int Id { get; set; }

        public required global::System.Func<double, double> Process { get; set; }
    }
    public class __Anon_AnonymousObjects_19_26
    {
        public required int Value { get; set; }
    }

            public static class AnonymousObjects
            {
                public static readonly __Anon_AnonymousObjects_2_22 Point = new __Anon_AnonymousObjects_2_22 { X = 10, Y = 20 };

                public static readonly __Anon_AnonymousObjects_5_23 Config = new __Anon_AnonymousObjects_5_23 { Name = "test", Count = 42, Enabled = true };

                public static readonly __Anon_AnonymousObjects_12_24 Handler = new __Anon_AnonymousObjects_12_24 { Id = 1, Process = (double x) => x * 2 };

                private static readonly int Value = 100;

                public static readonly __Anon_AnonymousObjects_19_26 Shorthand = new __Anon_AnonymousObjects_19_26 { Value = Value };
            }
}