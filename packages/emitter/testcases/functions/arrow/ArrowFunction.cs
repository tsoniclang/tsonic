using Tsonic.Runtime;
using System;

namespace TestCases.functions
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
