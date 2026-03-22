namespace TestCases.common.types.expectedtypethreading
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ArraySpread
    {
        internal static readonly int[] source = new int[] { (int)1, (int)2, (int)3 };

        public static readonly int[] withSpread = global::System.Linq.Enumerable.ToArray(global::System.Linq.Enumerable.Concat(source, new int[] { (int)4, (int)5 }));

        internal static readonly int[] more = new int[] { (int)10, (int)20 };

        public static readonly int[] multiSpread = global::System.Linq.Enumerable.ToArray(global::System.Linq.Enumerable.Concat(global::System.Linq.Enumerable.Concat(source, more), new int[] { (int)100 }));
    }
}