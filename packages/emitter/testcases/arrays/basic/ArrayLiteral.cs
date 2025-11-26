using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.arrays.basic
{
        public static class ArrayLiteral
        {
            public static List<double> createArray()
                {
                var arr = new List<int> { 1, 2, 3 };
                return arr;
                }
        }
}