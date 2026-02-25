// Generated from: OptionalChaining.ts
// Generated at: 2026-02-25T03:00:34.580Z
// WARNING: Do not modify this file manually

namespace TestCases.common.operators.optionalchaining
{
    public class User
    {
        public string? name { get; set; }
        public global::TestCases.common.operators.optionalchaining.__Anon_5026_7da65eac? address { get; set; }
    }

    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class OptionalChaining
    {
        public static string? getCity(User? user)
        {
            return user?.address?.city;
        }

        public static double getNameLength(User? user)
        {
            return user?.name?.Length ?? 0;
        }
    }
}