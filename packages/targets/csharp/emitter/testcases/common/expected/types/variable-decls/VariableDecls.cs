namespace TestCases.common.types.variabledecls
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class VariableDecls
    {
        public const double inferredDouble = 42.5;

        public const int inferredInt = 42;

        public const string inferredString = "hello";

        public const bool inferredBool = true;

        public const int explicitInt = 42;

        public const byte explicitByte = 255;

        public const short explicitShort = 1000;

        public const long explicitLong = 1000000L;

        public const float explicitFloat = 1.5f;

        public const double explicitDouble = 1.5;

        public const string explicitString = "world";

        public const bool explicitBool = false;

        public const int assertedInt = 42;

        public static readonly byte assertedByte = 255;

        public static readonly short assertedShort = 1000;

        public static readonly long assertedLong = 1000000L;

        public static readonly float assertedFloat = 1.5f;

        public static readonly double assertedDouble = 42;

        public static void localDeclarations()
        {
            var localInferredDouble = 42.5;
            var localInferredInt = 42;
            var localInferredString = "local";
            var localInferredBool = true;
            int localExplicitInt = 100;
            byte localExplicitByte = 200;
            float localExplicitFloat = 3.14f;
            string localExplicitString = "explicit";
            var localAssertedInt = 200;
            var localAssertedFloat = 3.14f;
            var localAssertedDouble = 100;
        }

        public static int mutableInt = 0;

        public static string mutableString = "";

        public const int immutableInt = 42;
    }
}
