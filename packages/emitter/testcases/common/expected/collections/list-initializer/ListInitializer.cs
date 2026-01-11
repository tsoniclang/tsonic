namespace TestCases.common.collections.listinitializer
{
    public class User
    {
        public int Id;

        public User(int id)
            {
            this.Id = id;
            }
    }

            public static class ListInitializer
            {
                public static global::System.Collections.Generic.List<int> MakeInts()
                    {
                    return new global::System.Collections.Generic.List<int> { 1, 2, 3 };
                    }

                public static global::System.Collections.Generic.List<string> MakeStrings()
                    {
                    return new global::System.Collections.Generic.List<string> { "a", "b" };
                    }

                public static global::System.Collections.Generic.List<User> MakeUsers()
                    {
                    var u1 = new User(1);
                    var u2 = new User(2);
                    return new global::System.Collections.Generic.List<User> { u1, u2 };
                    }
            }
}