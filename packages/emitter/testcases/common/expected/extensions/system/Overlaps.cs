namespace TestCases.common.extensions.system
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class Overlaps
    {
        public static void run()
        {
            var s = "hello";
            var a = global::System.MemoryExtensions.AsSpan(s);
            var b = global::System.MemoryExtensions.AsSpan(s, 1);
            int off = 0;
            var ok1 = global::System.MemoryExtensions.Overlaps(a, b);
            var ok2 = global::System.MemoryExtensions.Overlaps(a, b, out off);
            global::System.Console.WriteLine($"ok1: {(global::js.Globals.String(ok1))}");
            global::System.Console.WriteLine($"ok2: {(global::js.Globals.String(ok2))} off: {(global::js.Globals.String(off))}");
        }
    }
}
