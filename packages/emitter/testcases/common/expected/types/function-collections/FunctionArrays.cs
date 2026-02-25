// Generated from: FunctionArrays.ts
// Generated at: 2026-02-25T03:00:48.697Z
// WARNING: Do not modify this file manually

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
        // type Operation = global::System.Func<int, int, int>

        public static readonly global::System.Func<int, int, int>[] operations;

        static FunctionArrays()
        {
            operations = new global::System.Func<int, int, int>[] { (int a, int b) => a + b, (int a, int b) => a - b, (int a, int b) => a * b };
        }
    }
}