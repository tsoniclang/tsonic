using Tsonic.Runtime;
using System.Collections.Generic;

namespace TestCases.arrays
{
    public static class ArrayLiteral
    {
        public static List<double> createArray()
            {
            var arr = new List<object> { 1.0, 2.0, 3.0 };
            return arr;
            }
    }
}
