using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.functions.basic
{
        public static class Greet
        {
            public static string greet(string name)
                {
                return $"Hello {name}";
                }
        }
}