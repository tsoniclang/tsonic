namespace TestCases.common.types.functioncollections
{
    public class OperationMap
    {
        public required global::System.Func<int, int, int> add { get; set; }

        public required global::System.Func<int, int, int> subtract { get; set; }

        public required global::System.Func<int, int, int> multiply { get; set; }
    }

    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class FunctionArrays
    {
        public static readonly global::System.Func<int, int, int>[] operations = new global::System.Func<int, int, int>[] { (int a, int b) => a + b, (int a, int b) => a - b, (int a, int b) => a * b };
    }
}