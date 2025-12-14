// Generated from: calculator.ts
// Generated at: 2025-12-13T16:22:31.616Z
// WARNING: Do not modify this file manually

namespace TestCases.realworld.calculator
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
            if (b == 0)
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
                    global::Tsonic.JSRuntime.console.log("5 + 3 =", calc.add(5, 3));
                    global::Tsonic.JSRuntime.console.log("10 - 4 =", calc.subtract(10, 4));
                    global::Tsonic.JSRuntime.console.log("6 * 7 =", calc.multiply(6, 7));
                    global::Tsonic.JSRuntime.console.log("20 / 5 =", calc.divide(20, 5));
                    }
            }
}