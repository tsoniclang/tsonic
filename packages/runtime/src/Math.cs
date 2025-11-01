/**
 * JavaScript Math namespace implementation
 */

using System;
using System.Linq;

namespace Tsonic.Runtime
{
    /// <summary>
    /// Math namespace with JavaScript constants and functions
    /// </summary>
    public static class Math
    {
        // Mathematical constants
        public const double E = 2.718281828459045;
        public const double PI = 3.141592653589793;
        public const double LN2 = 0.6931471805599453;
        public const double LN10 = 2.302585092994046;
        public const double LOG2E = 1.4426950408889634;
        public const double LOG10E = 0.4342944819032518;
        public const double SQRT1_2 = 0.7071067811865476;
        public const double SQRT2 = 1.4142135623730951;

        // Common mathematical functions
        public static double abs(double x) => System.Math.Abs(x);
        public static double ceil(double x) => System.Math.Ceiling(x);
        public static double floor(double x) => System.Math.Floor(x);
        public static double round(double x) => System.Math.Round(x);
        public static double sqrt(double x) => System.Math.Sqrt(x);
        public static double pow(double x, double y) => System.Math.Pow(x, y);

        // Min/max with params
        public static double max(params double[] values) => values.Max();
        public static double min(params double[] values) => values.Min();

        // Trigonometric functions
        public static double sin(double x) => System.Math.Sin(x);
        public static double cos(double x) => System.Math.Cos(x);
        public static double tan(double x) => System.Math.Tan(x);
        public static double asin(double x) => System.Math.Asin(x);
        public static double acos(double x) => System.Math.Acos(x);
        public static double atan(double x) => System.Math.Atan(x);
        public static double atan2(double y, double x) => System.Math.Atan2(y, x);

        // Exponential and logarithmic
        public static double exp(double x) => System.Math.Exp(x);
        public static double log(double x) => System.Math.Log(x);
        public static double log10(double x) => System.Math.Log10(x);
        public static double log2(double x) => System.Math.Log2(x);

        // Random number generation
        private static readonly Random _random = new Random();
        public static double random() => _random.NextDouble();

        // Sign and truncation
        public static double sign(double x) => System.Math.Sign(x);
        public static double trunc(double x) => System.Math.Truncate(x);

        // Hyperbolic functions
        public static double sinh(double x) => System.Math.Sinh(x);
        public static double cosh(double x) => System.Math.Cosh(x);
        public static double tanh(double x) => System.Math.Tanh(x);
        public static double asinh(double x) => System.Math.Asinh(x);
        public static double acosh(double x) => System.Math.Acosh(x);
        public static double atanh(double x) => System.Math.Atanh(x);

        // Additional math functions
        public static double cbrt(double x) => System.Math.Cbrt(x);
        public static double hypot(params double[] values)
        {
            double sum = 0;
            foreach (double v in values)
            {
                sum += v * v;
            }
            return System.Math.Sqrt(sum);
        }

        public static double expm1(double x) => System.Math.Exp(x) - 1;
        public static double log1p(double x) => System.Math.Log(1 + x);

        // Floating point operations
        public static double fround(double x) => (double)(float)x;
        public static int imul(int a, int b) => a * b;
        public static int clz32(int x)
        {
            if (x == 0) return 32;
            return System.Numerics.BitOperations.LeadingZeroCount((uint)x);
        }

        // ES2024: Round to 16-bit float
        public static double f16round(double x)
        {
            // Convert to half precision (16-bit) and back
            var half = (Half)(float)x;
            return (double)half;
        }
    }
}
