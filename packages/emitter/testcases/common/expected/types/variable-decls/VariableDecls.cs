namespace TestCases.common.types.variabledecls
{
        public static class VariableDecls
        {
            public static readonly double inferredDouble = 42.5;

            public static readonly double inferredInt = 42;

            public static readonly string inferredString = "hello";

            public static readonly bool inferredBool = true;

            public static readonly int explicitInt = 42;

            public static readonly byte explicitByte = 255;

            public static readonly short explicitShort = 1000;

            public static readonly long explicitLong = 1000000L;

            public static readonly float explicitFloat = 1.5f;

            public static readonly double explicitDouble = 1.5;

            public static readonly string explicitString = "world";

            public static readonly bool explicitBool = false;

            public static readonly int assertedInt = 42;

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
                var localExplicitInt = 100;
                byte localExplicitByte = 200;
                var localExplicitFloat = 3.14f;
                var localExplicitString = "explicit";
                var localAssertedInt = 200;
                var localAssertedFloat = 3.14f;
                var localAssertedDouble = 100;
                }

            public static int mutableInt = 0;

            public static string mutableString = "";

            public static readonly int immutableInt = 42;
        }
}