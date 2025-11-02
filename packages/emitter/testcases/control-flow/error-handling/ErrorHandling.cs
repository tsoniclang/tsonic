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
            throw new Exception("Division by zero");
            }
            return a / b;
            }
            catch (Exception error)
            {
            console.log(error);
            return 0.0;
            }
            finally
            {
            console.log("Operation complete");
            }
            }
    }
}
