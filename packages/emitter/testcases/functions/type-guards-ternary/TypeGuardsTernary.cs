// Generated from: TypeGuardsTernary.ts
// Generated at: 2025-12-13T16:22:31.508Z
// WARNING: Do not modify this file manually

namespace TestCases.functions.typeguardsternary
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
    }

            public static class TypeGuardsTernary
            {
                // type Account = global::Tsonic.Runtime.Union<User, Admin>

                public static bool isUser(Account account)
                    {
                    return account.Match(__m1 => __m1.kind, __m2 => __m2.kind) == "user";
                    }

                public static string nameOrAnon(Account a)
                    {
                    return a.Is1() ? (a.As1()).username : "anon";
                    }

                public static string adminOrUser(Account a)
                    {
                    return !a.Is1() ? "Admin" : (a.As1()).username;
                    }

                public static string getEmailOrDefault(Account a)
                    {
                    return a.Is1() ? (a.As1()).email : "no-email";
                    }

                public static string getUsernameUpper(Account a)
                    {
                    return a.Is1() ? global::Tsonic.JSRuntime.String.toUpperCase((a.As1()).username) : "ANON";
                    }
            }
}