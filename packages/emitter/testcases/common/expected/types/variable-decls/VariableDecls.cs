// Generated from: VariableDecls.ts
// Generated at: 2026-02-25T03:01:06.554Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.variabledecls
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class VariableDecls
    {
        public static readonly double inferredDouble;

        public static readonly int inferredInt;

        public static readonly string inferredString;

        public static readonly bool inferredBool;

        public static readonly int explicitInt;

        public static readonly byte explicitByte;

        public static readonly short explicitShort;

        public static readonly long explicitLong;

        public static readonly float explicitFloat;

        public static readonly double explicitDouble;

        public static readonly string explicitString;

        public static readonly bool explicitBool;

        public static readonly int assertedInt;

        public static readonly byte assertedByte;

        public static readonly short assertedShort;

        public static readonly long assertedLong;

        public static readonly float assertedFloat;

        public static readonly double assertedDouble;

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

        public static int mutableInt;

        public static string mutableString;

        public static readonly int immutableInt;

        static VariableDecls()
        {
            inferredDouble = 42.5;
            inferredInt = 42;
            inferredString = "hello";
            inferredBool = true;
            explicitInt = 42;
            explicitByte = 255;
            explicitShort = 1000;
            explicitLong = 1000000L;
            explicitFloat = 1.5f;
            explicitDouble = 1.5;
            explicitString = "world";
            explicitBool = false;
            assertedInt = 42;
            assertedByte = 255;
            assertedShort = 1000;
            assertedLong = 1000000L;
            assertedFloat = 1.5f;
            assertedDouble = 42;
            mutableInt = 0;
            mutableString = "";
            immutableInt = 42;
        }
    }
}