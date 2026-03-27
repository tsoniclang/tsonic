namespace TestCases.common.types.expectedtypethreading
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ArraySpread
    {
        internal static readonly int[] source = new int[] { 1, 2, 3 };

        public static readonly int[] withSpread = global::System.Linq.Enumerable.ToArray(global::System.Linq.Enumerable.Concat(source, new int[] { 4, 5 }));

        internal static readonly int[] more = new int[] { 10, 20 };

        public static readonly int[] multiSpread = global::System.Linq.Enumerable.ToArray(global::System.Linq.Enumerable.Concat(global::System.Linq.Enumerable.Concat(source, more), new int[] { 100 }));
    }
}
