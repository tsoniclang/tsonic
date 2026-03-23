namespace TestCases.common.types.variabledecls
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class VariableDecls
    {
        public static readonly double inferredDouble = 42.5;

        public static readonly int inferredInt = 42;

        public static readonly string inferredString = "hello";

        public static readonly bool inferredBool = true;

        public static readonly int explicitInt = (int)42;

        public static readonly byte explicitByte = (byte)255;

        public static readonly short explicitShort = (short)1000;

        public static readonly long explicitLong = (long)1000000L;

        public static readonly float explicitFloat = 1.5f;

        public static readonly double explicitDouble = 1.5;

        public static readonly string explicitString = "world";

        public static readonly bool explicitBool = false;

        public static readonly int assertedInt = 42;

        public static readonly byte assertedByte = (byte)255;

        public static readonly short assertedShort = (short)1000;

        public static readonly long assertedLong = (long)1000000L;

        public static readonly float assertedFloat = 1.5f;

        public static readonly double assertedDouble = 42;

        public static void localDeclarations()
        {
            var localInferredDouble = 42.5;
            var localInferredInt = 42;
            var localInferredString = "local";
            var localInferredBool = true;
            int localExplicitInt = (int)100;
            byte localExplicitByte = (byte)200;
            float localExplicitFloat = 3.14f;
            string localExplicitString = "explicit";
            var localAssertedInt = 200;
            var localAssertedFloat = 3.14f;
            var localAssertedDouble = 100;
        }

        public static int mutableInt = (int)0;

        public static string mutableString = "";

        public static readonly int immutableInt = (int)42;
    }
}