// Generated from: NullishCoalescing.ts
// Generated at: 2026-02-25T03:00:33.327Z
// WARNING: Do not modify this file manually

namespace TestCases.common.operators.nullishcoalescing
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
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