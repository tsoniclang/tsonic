namespace TestCases.common.classes.constructor
{
    public class User
    {
        public string Name;

        public string Email;

        private string Password;

        public User(string name, string email, string password)
            {
            this.Name = name;
            this.Email = email;
            this.Password = password;
            }

        public bool Authenticate(string input)
            {
            return input == this.Password;
            }
    }
}