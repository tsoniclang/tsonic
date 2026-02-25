// Generated from: ArrowFunction.ts
// Generated at: 2026-02-25T03:00:19.136Z
// WARNING: Do not modify this file manually

namespace TestCases.common.functions.arrow
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ArrowFunction
    {
        public static readonly global::System.Func<double, double, double> add;

        public static readonly global::System.Func<string, string> greet;

        static ArrowFunction()
        {
            add = (double a, double b) => a + b;
            greet = (string name) =>
            {
            return $"Hello {name}";
            };
        }
    }
}