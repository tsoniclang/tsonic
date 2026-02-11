namespace TestCases.common.operators.optionalchaining
{
    public class address
    {
        public string? street { get; set; }

        public string? city { get; set; }
    }
    public class User
    {
        public string? name { get; set; }

        public address? address { get; set; }
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