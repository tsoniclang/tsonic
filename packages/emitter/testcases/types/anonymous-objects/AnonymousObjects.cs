// Generated from: AnonymousObjects.ts
// Generated at: 2025-12-13T16:22:31.711Z
// WARNING: Do not modify this file manually

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
                public static readonly object point = new __Anon_AnonymousObjects_2_22 { x = 10, y = 20 };

                public static readonly object config = new __Anon_AnonymousObjects_5_23 { name = "test", count = 42, enabled = true };

                public static readonly object handler = new __Anon_AnonymousObjects_12_24 { id = 1, process = (double x) => x * 2 };

                private static readonly int value = 100;

                public static readonly object shorthand = new __Anon_AnonymousObjects_19_26 { value = value };
            }
}