namespace TestCases.common.types.interfaces
{
    public class User
    {
        public required string Name { get; set; }

        public required string Email { get; set; }

        public required double Age { get; set; }
    }
    public class Point
    {
        public required double X { get; init; }

        public required double Y { get; init; }
    }

            public static class Interfaces
            {
                public static string GreetUser(User user)
                    {
                    return $"Hello {user.Name}, age {user.Age}";
                    }
            }
}
