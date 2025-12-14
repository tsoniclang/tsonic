// Generated from: Loops.ts
// Generated at: 2025-12-13T16:22:31.420Z
// WARNING: Do not modify this file manually

namespace TestCases.controlflow.loops
{
        public static class Loops
        {
            public static double sumEven(global::System.Collections.Generic.List<double> numbers)
                {
                var sum = 0;
                for (int i = 0; i < global::Tsonic.JSRuntime.Array.length(numbers); i++)
                    {
                    if (global::Tsonic.JSRuntime.Array.get(numbers, i) % 2 != 0)
                        {
                        continue;
                        }
                    sum += global::Tsonic.JSRuntime.Array.get(numbers, i);
                    }
                return sum;
                }

            public static double findFirst(global::System.Collections.Generic.List<double> numbers, double target)
                {
                var i = 0;
                while (i < global::Tsonic.JSRuntime.Array.length(numbers))
                    {
                    if (global::Tsonic.JSRuntime.Array.get(numbers, i) == target)
                        {
                        break;
                        }
                    i++;
                    }
                return i;
                }
        }
}