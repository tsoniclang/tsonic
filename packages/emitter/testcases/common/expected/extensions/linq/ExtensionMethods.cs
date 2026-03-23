namespace TestCases.common.extensions.linq
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ExtensionMethods
    {
        public static int inc(this int x)
        {
            return x + 1;
        }

        public static void run()
        {
            var numbers = new global::System.Collections.Generic.List<int>();
            numbers.Add((int)1);
            numbers.Add((int)2);
            numbers.Add((int)3);
            numbers.Add((int)4);
            var xs = (global::System.Collections.Generic.IEnumerable<int>)numbers;
            var doubled = global::System.Linq.Enumerable.Select(global::System.Linq.Enumerable.Where(xs, (int n) => n % 2 == (int)0), (int n) => n * 2).ToList();
            global::System.Console.WriteLine(doubled.Count);
            global::System.Console.WriteLine(inc((int)5));
        }
    }
}
