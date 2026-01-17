// Generated from: Overlaps.ts
// Generated at: 2026-01-17T15:37:02.213Z
// WARNING: Do not modify this file manually

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
                int off = 0;
                var ok1 = global::System.MemoryExtensions.Overlaps(a, b);
                var ok2 = global::System.MemoryExtensions.Overlaps(a, b, out off);
                global::System.Console.WriteLine($"ok1: {ok1}");
                global::System.Console.WriteLine($"ok2: {ok2} off: {off}");
                }
        }
}