// Generated from: OptionalChaining.ts
// Generated at: 2026-01-17T15:37:16.724Z
// WARNING: Do not modify this file manually

namespace TestCases.common.operators.optionalchaining
{
    public class User
    {
        public string? name { get; set; }

        public address? address { get; set; }
    }
    public class address
    {
        public string? street { get; set; }
        public string? city { get; set; }
    }

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