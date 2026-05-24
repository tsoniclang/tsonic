namespace TestCases.common.types.tuplesarity
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class TuplesArity
    {
        public static readonly global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double>> t8 = (1, 2, 3, 4, 5, 6, 7, 8);

        public static readonly global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double, double>> t9 = (1, 2, 3, 4, 5, 6, 7, 8, 9);

        public static global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double>> makeT8()
        {
            return (10, 20, 30, 40, 50, 60, 70, 80);
        }

        public static double sumT8(global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double>> t)
        {
            return t.Item1 + t.Item2 + t.Item3 + t.Item4 + t.Item5 + t.Item6 + t.Item7 + t.Item8;
        }
    }
}
