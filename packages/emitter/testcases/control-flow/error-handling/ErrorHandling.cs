using Tsonic.Runtime;

namespace TestCases.ControlFlow
{
    public static class ErrorHandling
    {
        public static double safeDivide(double a, double b)
            {
            try
            {
            if (b == 0.0)
                {
                throw new Error("Division by zero");
                }
            return a / b;
            }
            catch (Exception error)
            {
            Tsonic.Runtime.console.log(error);
            return 0.0;
            }
            finally
            {
            Tsonic.Runtime.console.log("Operation complete");
            }
            }
    }
}
