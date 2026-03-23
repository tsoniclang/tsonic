namespace TestCases.common.operators.inoperator
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class InOperator
    {
        public static readonly global::System.Func<bool, string> check = check__Impl;

        private static string check__Impl(bool fail)
        {
            var auth = global::TestCases.common.operators.inoperator.Auth.getAuth(fail);
            if (auth.Is1())
            {
                var auth__1_1 = auth.As1();
                return auth__1_1.error;
            }
            return "ok";
        }
    }
}