namespace TestCases.common.types.variabledecls
{
        public static class VariableDecls
        {
            public static readonly double InferredDouble = 42.5;

            public static readonly int InferredInt = 42;

            public static readonly string InferredString = "hello";

            public static readonly bool InferredBool = true;

            public static readonly int ExplicitInt = 42;

            public static readonly byte ExplicitByte = 255;

            public static readonly short ExplicitShort = 1000;

            public static readonly long ExplicitLong = 1000000L;

            public static readonly float ExplicitFloat = 1.5f;

            public static readonly double ExplicitDouble = 1.5;

            public static readonly string ExplicitString = "world";

            public static readonly bool ExplicitBool = false;

            public static readonly int AssertedInt = 42;

            public static readonly byte AssertedByte = 255;

            public static readonly short AssertedShort = 1000;

            public static readonly long AssertedLong = 1000000L;

            public static readonly float AssertedFloat = 1.5f;

            public static readonly double AssertedDouble = 42;

            public static void LocalDeclarations()
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

            public static int MutableInt = 0;

            public static string MutableString = "";

            public static readonly int ImmutableInt = 42;
        }
}