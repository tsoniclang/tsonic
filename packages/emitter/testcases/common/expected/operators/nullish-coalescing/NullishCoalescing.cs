// Generated from: NullishCoalescing.ts
// Generated at: 2026-01-17T15:37:15.515Z
// WARNING: Do not modify this file manually

namespace TestCases.common.operators.nullishcoalescing
{
        public static class NullishCoalescing
        {
            public static string getDefault(string? value)
                {
                return value ?? "default";
                }

            public static double getNumber(double? value)
                {
                return value ?? 0;
                }
        }
}