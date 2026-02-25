// Generated from: ReturningFunctions.ts
// Generated at: 2026-02-25T03:00:27.844Z
// WARNING: Do not modify this file manually

namespace TestCases.common.functions.higherorder
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ReturningFunctions
    {
        public static global::System.Func<int, int> add(int a)
        {
            return (int b) => a + b;
        }

        public static global::System.Func<string> makeRepeater(string value)
        {
            return () => value;
        }

        public static global::System.Func<global::System.Func<string>> createNested()
        {
            return () => () => "deeply nested";
        }
    }
}