using Tsonic.Runtime;

namespace TestCases.control-flow
{
    public static class Loops
    {
        public static double sumEven(Tsonic.Runtime.Array<double> numbers)
            {
            var sum = 0.0;
            for (var i = 0.0; i < numbers.length; i++)
            {
            if (numbers[i] % 2.0 != 0.0)
            {
            continue;
            }
            sum += numbers[i];
            }
            return sum;
            }

        public static double findFirst(Tsonic.Runtime.Array<double> numbers, double target)
            {
            var i = 0.0;
            while (i < numbers.length)
            {
            if (numbers[i] == target)
            {
            break;
            }
            i++;
            }
            return i;
            }
    }
}
