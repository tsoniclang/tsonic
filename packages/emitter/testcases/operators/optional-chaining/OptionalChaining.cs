using Tsonic.Runtime;

namespace TestCases.operators
{
    public class User
    {
        public string? name { get; set; }
        public Address? address { get; set; }
    }

    public class Address
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
            return user?.name?.length ?? 0.0;
            }
    }
}
