// Generated from: ErrorHandling.ts
// Generated at: 2025-12-13T16:22:31.408Z
// WARNING: Do not modify this file manually

namespace TestCases.controlflow.errorhandling
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