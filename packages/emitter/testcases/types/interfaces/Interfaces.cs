namespace TestCases.types.interfaces
{
    public class User
    {
        public string name { get; set; }

        public string email { get; set; }

        public double age { get; set; }
    }
    public class Point
    {
        public double x { get; }

        public double y { get; }
    }

            public static class Interfaces
            {
                public static string greetUser(User user)
                    {
                    return $"Hello {user.name}, age {user.age}";
                    }
            }
}