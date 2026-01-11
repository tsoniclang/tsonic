namespace TestCases.common.types.functioncollections
{
    public class OperationMap
    {
        public required global::System.Func<int, int, int> Add { get; set; }

        public required global::System.Func<int, int, int> Subtract { get; set; }

        public required global::System.Func<int, int, int> Multiply { get; set; }
    }

            public static class FunctionArrays
            {
                // type Operation = global::System.Func<int, int, int>

                public static readonly global::System.Func<int, int, int>[] Operations = new global::System.Func<int, int, int>[] { (int a, int b) => a + b, (int a, int b) => a - b, (int a, int b) => a * b };
            }
}