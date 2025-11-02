using Tsonic.Runtime;

namespace TestCases.arrays
{
    public static class ArrayLiteral
    {
        public static Tsonic.Runtime.Array<double> createArray()
            {
            var arr = new Tsonic.Runtime.Array<object>(1.0, 2.0, 3.0);
            return arr;
            }
    }
}
