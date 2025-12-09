namespace TestCases.types.tuplesarity
{
        public static class TuplesArity
        {
            // type T8 = global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double>>

            // type T9 = global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double, double>>

            public static readonly global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double>> t8 = (1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0);

            public static readonly global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double, double>> t9 = (1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0);

            public static global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double>> makeT8()
                {
                return (10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0);
                }

            public static double sumT8(global::System.ValueTuple<double, double, double, double, double, double, double, global::System.ValueTuple<double>> t)
                {
                return t[0] + t[1] + t[2] + t[3] + t[4] + t[5] + t[6] + t[7];
                }
        }
}