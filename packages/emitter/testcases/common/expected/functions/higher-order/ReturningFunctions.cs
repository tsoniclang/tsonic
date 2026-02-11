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