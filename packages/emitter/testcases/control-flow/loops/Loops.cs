using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.controlflow.loops
{
        public static class Loops
        {
            public static double sumEven(List<double> numbers)
                {
                var sum = 0;
                for (var i = 0; i < Tsonic.Runtime.Array.length(numbers); i++)
                    {
                    if (Tsonic.Runtime.Array.get(numbers, i) % 2 != 0)
                        {
                        continue;
                        }
                    sum += Tsonic.Runtime.Array.get(numbers, i);
                    }
                return sum;
                }

            public static double findFirst(List<double> numbers, double target)
                {
                var i = 0;
                while (i < Tsonic.Runtime.Array.length(numbers))
                    {
                    if (Tsonic.Runtime.Array.get(numbers, i) == target)
                        {
                        break;
                        }
                    i++;
                    }
                return i;
                }
        }
}