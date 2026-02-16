namespace TestCases.common.classes.fieldmarker
{
    public class User
    {
        public string name = "alice";

        public string nickname { get; set; } = "ali";

        public readonly string email = "a@example.com";
    }
}
