
using Tsonic.Runtime;

namespace TestCases.realworld
{
    public class Calculator
    {
        public double add(double a, double b)
            {
            return a + b;
            }

        public double subtract(double a, double b)
            {
            return a - b;
            }

        public double multiply(double a, double b)
            {
            return a * b;
            }

        public double divide(double a, double b)
            {
            if (b == 0.0)
                {
                throw new Error("Division by zero");
                }
            return a / b;
            }
    }

    public static class calculator
    {
        public static void runCalculatorTests()
            {
            var calc = new Calculator();
            Tsonic.Runtime.console.log("5 + 3 =", calc.add(5.0, 3.0));
            Tsonic.Runtime.console.log("10 - 4 =", calc.subtract(10.0, 4.0));
            Tsonic.Runtime.console.log("6 * 7 =", calc.multiply(6.0, 7.0));
            Tsonic.Runtime.console.log("20 / 5 =", calc.divide(20.0, 5.0));
            }
    }
}