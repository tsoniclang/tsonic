using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

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

        public List<string> permissions { get; set; }
    }
    public class Guest
    {
        public string type { get; set; }

        public string sessionId { get; set; }
    }

            public static class typeguards
            {
                // type Account = Union<User, Admin, Guest>

                public static dynamic isUser(Account account)
                    {
                    return account.type == "user";
                    }

                public static dynamic isAdmin(Account account)
                    {
                    return account.type == "admin";
                    }

                public static dynamic isGuest(Account account)
                    {
                    return account.type == "guest";
                    }

                public static string getAccountDescription(Account account)
                    {
                    if (isUser(account))
                        {
                        return $"User: {account.username} ({account.email})";
                        }
                    else
                        if (isAdmin(account))
                            {
                            return $"Admin: {account.username} with {Tsonic.Runtime.Array.length(account.permissions)} permissions";
                            }
                        else
                            if (isGuest(account))
                                {
                                return $"Guest session: {account.sessionId}";
                                }
                    return "Unknown account type";
                    }

                public static bool hasEmail(Account account)
                    {
                    return isUser(account) || isAdmin(account);
                    }

                public static List<string> getPermissions(Account account)
                    {
                    if (isAdmin(account))
                        {
                        return account.permissions;
                        }
                    return new List<string>();
                    }

                public static string processValue(Union<string, double, bool> value)
                    {
                    if (Tsonic.Runtime.Operators.@typeof(value) == "string")
                        {
                        return Tsonic.JSRuntime.String.toUpperCase(value);
                        }
                    else
                        if (Tsonic.Runtime.Operators.@typeof(value) == "number")
                            {
                            return Tsonic.JSRuntime.Number.toFixed(value, 2);
                            }
                        else
                            {
                            return value ? "yes" : "no";
                            }
                    }

                public static dynamic isStringArray(object? arr)
                    {
                    return Array.isArray(arr) && Tsonic.JSRuntime.Array.every(arr, (item) => Tsonic.Runtime.Operators.@typeof(item) == "string");
                    }
            }
}