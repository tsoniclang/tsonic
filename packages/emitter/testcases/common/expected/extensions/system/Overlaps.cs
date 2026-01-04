namespace TestCases.common.extensions.system
{
        public static class Overlaps
        {
            // type Ext = T

            public static void run()
                {
                var s = "hello";
                var a = global::System.MemoryExtensions.AsSpan((string)s);
                var b = global::System.MemoryExtensions.AsSpan((string)s, 1);
                var off = 0;
                var ok1 = global::System.MemoryExtensions.Overlaps(a, b);
                var ok2 = global::System.MemoryExtensions.Overlaps(a, b, out off);
                global::System.Console.WriteLine($"ok1: {ok1}");
                global::System.Console.WriteLine($"ok2: {ok2} off: {off}");
                }
        }
}