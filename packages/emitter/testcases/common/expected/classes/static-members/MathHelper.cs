namespace TestCases.common.classes.staticmembers
{
    public class MathHelper
    {
        public static double PI { get; set; } = 3.14159;

        public static double E { get; set; } = 2.71828;

        public static double square(double x)
            {
            return x * x;
            }

        public static double cube(double x)
            {
            return x * x * x;
            }
    }
}