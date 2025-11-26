using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System;
using System.Collections.Generic;

namespace TestCases.functions.arrow
{
        public static class ArrowFunction
        {
            public static readonly Func<double, double, double> add = (a, b) => a + b;

            public static readonly Func<string, string> greet = (name) =>
                {
                return $"Hello {name}";
                };
        }
}