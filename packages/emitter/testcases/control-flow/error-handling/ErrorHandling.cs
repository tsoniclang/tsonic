using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

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
                Tsonic.JSRuntime.console.log(error);
                return 0;
                }
                finally
                {
                Tsonic.JSRuntime.console.log("Operation complete");
                }
                }
        }
}