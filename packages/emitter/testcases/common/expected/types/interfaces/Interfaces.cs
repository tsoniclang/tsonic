// Generated from: Interfaces.ts
// Generated at: 2026-02-25T03:01:00.086Z
// WARNING: Do not modify this file manually

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
        public required double x { get; init; }
        public required double y { get; init; }
    }

    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class Interfaces
    {
        public static string greetUser(User user)
        {
            return $"Hello {user.name}, age {user.age}";
        }
    }
}