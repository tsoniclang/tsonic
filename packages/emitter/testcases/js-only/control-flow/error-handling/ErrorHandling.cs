namespace TestCases.jsonly.controlflow.errorhandling
{
        public static class ErrorHandling
        {
            public static double safeDivide(double a, double b)
                {
                try
                {
                if (b == 0)
                    {
                    throw new Error("Division by zero");
                    }
                return a / b;
                }
                catch (Exception error)
                {
                global::Tsonic.JSRuntime.console.log(error);
                return 0;
                }
                finally
                {
                global::Tsonic.JSRuntime.console.log("Operation complete");
                }
                }
        }
}