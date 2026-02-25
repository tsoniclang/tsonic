// Generated from: ArraySpread.ts
// Generated at: 2026-02-25T03:00:43.559Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.expectedtypethreading
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ArraySpread
    {
        internal static readonly int[] source;

        public static readonly int[] withSpread;

        internal static readonly int[] more;

        public static readonly int[] multiSpread;

        static ArraySpread()
        {
            source = new int[] { 1, 2, 3 };
            withSpread = new int[] { /* ...spread */, 4, 5 };
            more = new int[] { 10, 20 };
            multiSpread = new int[] { /* ...spread */, /* ...spread */, 100 };
        }
    }
}