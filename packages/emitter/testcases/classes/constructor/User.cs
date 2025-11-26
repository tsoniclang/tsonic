using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.classes.constructor
{
    public class User
    {
        public string name;

        public string email;

        private string password;

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