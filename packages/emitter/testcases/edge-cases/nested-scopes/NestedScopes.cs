using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.edgecases.nestedscopes
{
        public static class NestedScopes
        {
            public static double nestedScopes(double x)
                {
                var a = 10;
                {
                var b = 20;
                {
                var c = 30;
                return a + b + c + x;
                }
                }
                }
        }
}