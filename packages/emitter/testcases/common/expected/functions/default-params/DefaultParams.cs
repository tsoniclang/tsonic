// Generated from: DefaultParams.ts
// Generated at: 2026-02-25T03:00:25.252Z
// WARNING: Do not modify this file manually

namespace TestCases.common.functions.defaultparams
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class DefaultParams
    {
        public static string greet(string name, string greeting = "Hello")
        {
            return $"{greeting} {name}";
        }

        public static double multiply(double a, double b = 2)
        {
            return a * b;
        }
    }
}