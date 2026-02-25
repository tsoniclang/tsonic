// Generated from: ExtensionMethods.ts
// Generated at: 2026-02-25T03:00:16.449Z
// WARNING: Do not modify this file manually

using System.Linq;

namespace TestCases.common.extensions.linq
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ExtensionMethods
    {
        // type LinqSeq<T> = global::System.Collections.Generic.IEnumerable<T>

        public static int inc(this int x)
        {
            return x + 1;
        }

        public static void run()
        {
            var numbers = new global::System.Collections.Generic.List<int>();
            numbers.Add(1);
            numbers.Add(2);
            numbers.Add(3);
            numbers.Add(4);
            var xs = (global::System.Collections.Generic.IEnumerable<int>)numbers;
            var doubled = global::System.Linq.Enumerable.Select(global::System.Linq.Enumerable.Where(xs, (n) => n % 2 == 0), (n) => n * 2).ToList();
            global::System.Console.WriteLine(doubled.Count);
            global::System.Console.WriteLine(inc(5));
        }
    }
}