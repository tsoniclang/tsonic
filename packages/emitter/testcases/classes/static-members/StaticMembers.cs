using Tsonic.Runtime;

namespace TestCases.classes
{
    public class MathHelper
    {
        public static double PI = 3.14159;
        public static double E = 2.71828;

        public static double square(double x)
            {
            return x * x;
            }

        public static double cube(double x)
            {
            return x * x * x;
            }
    }

    public static class StaticMembers
    {
    }
}
