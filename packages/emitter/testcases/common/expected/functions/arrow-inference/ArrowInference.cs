// Generated from: ArrowInference.ts
// Generated at: 2026-02-25T03:00:20.347Z
// WARNING: Do not modify this file manually

namespace TestCases.common.functions.arrowinference
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ArrowInference
    {
        // type NumberToNumber = global::System.Func<double, double>

        public static readonly global::System.Func<double, double> @double;

        public static readonly global::System.Func<double, double> triple;

        // type BinaryOp = global::System.Func<double, double, double>

        public static readonly global::System.Func<double, double, double> add;

        static ArrowInference()
        {
            @double = (double x) => x * 2;
            triple = (double x) => x * 3;
            add = (double a, double b) => a + b;
        }
    }
}