namespace TestCases.common.types.tuplesarity
{
        [global::Tsonic.Internal.ModuleContainerAttribute]
        public static class TuplesArity
        {
            // type T8 = global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double>>

            // type T9 = global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double, double>>

            public static readonly global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double>> t8 = (1, 2, 3, 4, 5, 6, 7, 8);

            public static readonly global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double, double>> t9 = (1, 2, 3, 4, 5, 6, 7, 8, 9);

            public static global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double>> makeT8()
                {
                return (10, 20, 30, 40, 50, 60, 70, 80);
                }

            public static double sumT8(global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double>> t)
                {
                return t[0] + t[1] + t[2] + t[3] + t[4] + t[5] + t[6] + t[7];
                }
        }
}