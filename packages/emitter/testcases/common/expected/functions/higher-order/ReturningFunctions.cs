namespace TestCases.common.functions.higherorder
{
        public static class ReturningFunctions
        {
            public static global::System.Func<int, int> Add(int a)
                {
                return (int b) => a + b;
                }

            public static global::System.Func<string> MakeRepeater(string value)
                {
                return () => value;
                }

            public static global::System.Func<global::System.Func<string>> CreateNested()
                {
                return () => () => "deeply nested";
                }
        }
}