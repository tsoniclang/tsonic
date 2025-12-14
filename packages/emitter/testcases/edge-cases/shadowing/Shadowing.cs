// Generated from: Shadowing.ts
// Generated at: 2025-12-13T16:22:31.455Z
// WARNING: Do not modify this file manually

namespace TestCases.edgecases.shadowing
{
        public static class Shadowing
        {
            public static double shadowedVariable()
                {
                var x = 10;
                {
                var x = 20;
                return x;
                }
                }

            public static double shadowInFunction()
                {
                var value = 5;
                var inner = () =>
                {
                var value = 10;
                return value;
                };
                return value + inner();
                }
        }
}