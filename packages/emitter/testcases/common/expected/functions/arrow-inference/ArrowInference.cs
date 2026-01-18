// Generated from: ArrowInference.ts
// Generated at: 2026-01-17T15:37:04.516Z
// WARNING: Do not modify this file manually

namespace TestCases.common.functions.arrowinference
{
        public static class ArrowInference
        {
            // type NumberToNumber = global::System.Func<double, double>

            public static readonly global::System.Func<double, double> @double = (double x) => x * 2;

            public static readonly global::System.Func<double, double> triple = (double x) => x * 3;

            // type BinaryOp = global::System.Func<double, double, double>

            public static readonly global::System.Func<double, double, double> add = (double a, double b) => a + b;
        }
}