namespace TestCases.realworld.typeguards
{
    public class User
    {
        public string type { get; set; }

        public double id { get; set; }

        public string username { get; set; }

        public string email { get; set; }
    }
    public class Admin
    {
        public string type { get; set; }

        public double id { get; set; }

        public string username { get; set; }

        public string email { get; set; }

        public global::System.Collections.Generic.List<string> permissions { get; set; }
    }
    public class Guest
    {
        public string type { get; set; }

        public string sessionId { get; set; }
    }

            public static class typeguards
            {
                // type Account = global::Tsonic.Runtime.Union<User, Admin, Guest>

                public static bool isUser(Account account)
                    {
                    return account.type == "user";
                    }

                public static bool isAdmin(Account account)
                    {
                    return account.type == "admin";
                    }

                public static bool isGuest(Account account)
                    {
                    return account.type == "guest";
                    }

                public static string getAccountDescription(Account account)
                    {
                    if (account.Is1())
                    {
                        var account__1_1 = account.As1();
                        return $"User: {account__1_1.username} ({account__1_1.email})";
                    }
                    else
                        if (account.Is2())
                        {
                            var account__2_2 = account.As2();
                            return $"Admin: {account__2_2.username} with {(global::Tsonic.JSRuntime.Array.length(account__2_2.permissions))} permissions";
                        }
                        else
                            if (account.Is3())
                            {
                                var account__3_3 = account.As3();
                                return $"Guest session: {account__3_3.sessionId}";
                            }
                    return "Unknown account type";
                    }

                public static bool hasEmail(Account account)
                    {
                    return isUser(account) || isAdmin(account);
                    }

                public static global::System.Collections.Generic.List<string> getPermissions(Account account)
                    {
                    if (account.Is2())
                    {
                        var account__2_1 = account.As2();
                        return account__2_1.permissions;
                    }
                    return new global::System.Collections.Generic.List<string>();
                    }

                public static string processValue(global::Tsonic.Runtime.Union<string, double, bool> value)
                    {
                    if (global::Tsonic.Runtime.Operators.@typeof(value) == "string")
                        {
                        return global::Tsonic.JSRuntime.String.toUpperCase(value);
                        }
                    else
                        if (global::Tsonic.Runtime.Operators.@typeof(value) == "number")
                            {
                            return global::Tsonic.JSRuntime.Number.toFixed(value, 2.0);
                            }
                        else
                            {
                            return value ? "yes" : "no";
                            }
                    }

                public static bool isStringArray(object? arr)
                    {
                    return Array.isArray(arr) && global::Tsonic.JSRuntime.Array.every(arr, (object? item) => global::Tsonic.Runtime.Operators.@typeof(item) == "string");
                    }
            }
}