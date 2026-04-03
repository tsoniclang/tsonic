namespace TestCases.common.types.interfaces
{
    public class User
    {
        [global::System.Diagnostics.CodeAnalysis.SetsRequiredMembersAttribute]
        public User()
        {

        }

        public required string name { get; set; }

        public required string email { get; set; }

        public required double age { get; set; }
    }

    public class Point
    {
        [global::System.Diagnostics.CodeAnalysis.SetsRequiredMembersAttribute]
        public Point()
        {

        }

        public required double x { get; init; }

        public required double y { get; init; }
    }

    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class Interfaces
    {
        public static string greetUser(User user)
        {
            return $"Hello {(global::js.Globals.String(user.name))}, age {(global::js.Globals.String(user.age))}";
        }
    }
}
