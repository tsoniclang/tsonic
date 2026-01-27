// Generated from: InOperator.ts
// Generated at: 2026-01-27T06:19:53.709Z
// WARNING: Do not modify this file manually

namespace TestCases.common.operators.inoperator
{
        public static class InOperator
        {
            public static readonly global::System.Func<bool, string> check = (bool fail) =>
                {
                var auth = global::TestCases.common.operators.inoperator.Auth.getAuth(fail);
                if (auth.Is2())
                {
                    var auth__2_1 = auth.As2();
                    return auth__2_1.error;
                }
                return "ok";
                };
        }
}