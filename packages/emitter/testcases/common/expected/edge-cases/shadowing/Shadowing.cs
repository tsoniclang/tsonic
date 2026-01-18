// Generated from: Shadowing.ts
// Generated at: 2026-01-17T15:36:58.368Z
// WARNING: Do not modify this file manually

namespace TestCases.common.edgecases.shadowing
{
        public static class Shadowing
        {
            public static double shadowedVariable()
                {
                var x = 10;
                {
                var x__1 = 20;
                return x__1;
                }
                }

            public static double shadowInFunction()
                {
                var value = 5;
                var inner = () =>
                {
                var value__1 = 10;
                return value__1;
                };
                return value + inner();
                }
        }
}