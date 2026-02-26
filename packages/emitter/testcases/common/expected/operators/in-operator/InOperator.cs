namespace TestCases.common.operators.inoperator
{
        [global::Tsonic.Internal.ModuleContainerAttribute]
        public static class InOperator
        {
            public static readonly global::System.Func<bool, string> check = check__Impl;
            private static string check__Impl(bool fail)
                {
                var auth = global::TestCases.common.operators.inoperator.Auth.getAuth(fail);
                if (auth.Is2())
                    {
                    var auth__2_1 = auth.As2();
                    return auth__2_1.error;
                    }
                return "ok";
                }
        }
}