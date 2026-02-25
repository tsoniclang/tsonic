// Generated from: User.ts
// Generated at: 2026-02-25T02:59:47.875Z
// WARNING: Do not modify this file manually

namespace TestCases.common.classes.constructor
{
    public class User
    {
        public string name { get; set; }

        public string email { get; set; }

        private string password { get; set; }

        public User(string name, string email, string password)
        {
            this.name = name;
            this.email = email;
            this.password = password;
        }

        public bool authenticate(string input)
        {
            return input == this.password;
        }
    }
}