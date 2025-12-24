namespace TestCases.common.types.interfaces
{
    public class User
    {
        public required string name { get; set; }

        public required string email { get; set; }

        public required double age { get; set; }
    }
    public class Point
    {
        public required double x { get; }

        public required double y { get; }
    }

            public static class Interfaces
            {
                public static string greetUser(User user)
                    {
                    return $"Hello {user.name}, age {user.age}";
                    }
            }
}