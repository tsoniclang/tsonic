// Generated from: Closures.ts
// Generated at: 2026-02-25T03:00:24.040Z
// WARNING: Do not modify this file manually

namespace TestCases.common.functions.closures
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class Closures
    {
        public static global::System.Func<double> makeCounter()
        {
            var count = 0;
            return () =>
{
count++;
return count;
};
        }

        public static global::System.Func<double, double> makeAdder(double x)
        {
            return (double y) => x + y;
        }
    }
}