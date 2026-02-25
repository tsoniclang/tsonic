// Generated from: NullishCoalescing.ts
// Generated at: 2026-02-25T03:00:42.322Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.expectedtypethreading
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class NullishCoalescing
    {
        public static int getOrDefault(int? value)
        {
            return value ?? 100;
        }
    }
}