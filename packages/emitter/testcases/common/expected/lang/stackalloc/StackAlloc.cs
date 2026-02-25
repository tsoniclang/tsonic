// Generated from: StackAlloc.ts
// Generated at: 2026-02-25T03:00:30.460Z
// WARNING: Do not modify this file manually

namespace TestCases.common.lang.@stackalloc
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class StackAlloc
    {
        public static void run()
        {
            global::System.Span<int> buffer = stackalloc int[256];
            buffer[0] = 42;
            global::System.Console.WriteLine(buffer[0]);
            global::System.Console.WriteLine(buffer.Length);
        }
    }
}
