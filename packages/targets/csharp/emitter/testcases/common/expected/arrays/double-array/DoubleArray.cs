namespace TestCases.common.arrays.doublearray
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class DoubleArray
    {
        public static double[] createDoubleArray()
        {
            double[] arr = new double[] { 1, 2, 3 };
            return arr;
        }

        public static double[] returnDoubleArray()
        {
            return new double[] { 4, 5, 6 };
        }
    }
}