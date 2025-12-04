namespace TestCases.functions.typeguardsv2
{
    public class User
    {
        public string kind { get; set; }

        public string username { get; set; }

        public string email { get; set; }
    }
    public class Admin
    {
        public string kind { get; set; }

        public double adminId { get; set; }

        public global::System.Collections.Generic.List<string> permissions { get; set; }
    }

            public static class TypeGuardsV2
            {
                // type Account = global::Tsonic.Runtime.Union<User, Admin>

                public static bool isUser(Account account)
                    {
                    return account.kind == "user";
                    }

                public static bool isAdmin(Account account)
                    {
                    return account.kind == "admin";
                    }

                public static string handleNotUser(Account account)
                    {
                    if (!account.Is1())
                        {
                        return $"Admin {account.adminId}";
                        }
                    else
                    {
                        var account__1_1 = account.As1();
                        return $"User {account__1_1.username}";
                    }
                    }

                public static string getUserWithValidEmail(Account account)
                    {
                    if (account.Is1())
                    {
                        var account__1_1 = account.As1();
                        if (global::Tsonic.JSRuntime.String.length(account__1_1.email) > 0.0)
                            {
                            return account__1_1.email;
                            }
                    }
                        return "no email";
                    }

                public static string getUsernameUppercase(Account account)
                    {
                    if (account.Is1())
                    {
                        var account__1_1 = account.As1();
                        if (account__1_1.username != "")
                            {
                            return global::Tsonic.JSRuntime.String.toUpperCase(account__1_1.username);
                            }
                    }
                        return "anonymous";
                    }
            }
}