// Generated from: ArraySpread.ts
// Generated at: 2026-01-17T15:37:24.749Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.expectedtypethreading
{
        public static class ArraySpread
        {
            internal static readonly int[] source = new int[] { 1, 2, 3 };

            public static readonly int[] withSpread = new int[] { /* ...spread */, 4, 5 };

            internal static readonly int[] more = new int[] { 10, 20 };

            public static readonly int[] multiSpread = new int[] { /* ...spread */, /* ...spread */, 100 };
        }
}
