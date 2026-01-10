namespace TestCases.common.operators.optionalchaining
{
    public class User
    {
        public string? Name { get; set; }

        public Address? Address { get; set; }
    }
    public class Address
    {
        public string? Street { get; set; }
        public string? City { get; set; }
    }

            public static class OptionalChaining
            {
                public static string? GetCity(User? user)
                    {
                    return user?.Address?.City;
                    }

                public static double GetNameLength(User? user)
                    {
                    return user?.Name?.Length ?? 0;
                    }
            }
}