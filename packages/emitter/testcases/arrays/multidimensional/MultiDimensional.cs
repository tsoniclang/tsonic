using Tsonic.Runtime;

namespace TestCases.arrays
{
    public static class MultiDimensional
    {
        public static double getElement(Tsonic.Runtime.Array<Tsonic.Runtime.Array<double>> matrix)
            {
            return matrix[0][1];
            }

        public static Tsonic.Runtime.Array<Tsonic.Runtime.Array<double>> createMatrix()
            {
            return new Tsonic.Runtime.Array<object>(new Tsonic.Runtime.Array<object>(1.0, 2.0), new Tsonic.Runtime.Array<object>(3.0, 4.0));
            }
    }
}
