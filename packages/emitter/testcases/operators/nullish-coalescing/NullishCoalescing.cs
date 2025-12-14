// Generated from: NullishCoalescing.ts
// Generated at: 2025-12-13T16:22:31.535Z
// WARNING: Do not modify this file manually

namespace TestCases.operators.nullishcoalescing
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