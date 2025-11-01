using Xunit;

namespace Tsonic.Runtime.Tests
{
    public class MathTests
    {
        [Fact]
        public void Constants_HaveCorrectValues()
        {
            Assert.Equal(2.718281828459045, Math.E, 10);
            Assert.Equal(3.141592653589793, Math.PI, 10);
            Assert.Equal(0.6931471805599453, Math.LN2, 10);
            Assert.Equal(2.302585092994046, Math.LN10, 10);
            Assert.Equal(1.4426950408889634, Math.LOG2E, 10);
            Assert.Equal(0.4342944819032518, Math.LOG10E, 10);
            Assert.Equal(0.7071067811865476, Math.SQRT1_2, 10);
            Assert.Equal(1.4142135623730951, Math.SQRT2, 10);
        }

        [Theory]
        [InlineData(5, 5)]
        [InlineData(-5, 5)]
        [InlineData(0, 0)]
        [InlineData(3.14, 3.14)]
        public void abs_ReturnsAbsoluteValue(double input, double expected)
        {
            Assert.Equal(expected, Math.abs(input));
        }

        [Theory]
        [InlineData(3.1, 4)]
        [InlineData(3.9, 4)]
        [InlineData(-3.1, -3)]
        public void ceil_RoundsUp(double input, double expected)
        {
            Assert.Equal(expected, Math.ceil(input));
        }

        [Theory]
        [InlineData(3.1, 3)]
        [InlineData(3.9, 3)]
        [InlineData(-3.1, -4)]
        public void floor_RoundsDown(double input, double expected)
        {
            Assert.Equal(expected, Math.floor(input));
        }

        [Theory]
        [InlineData(3.1, 3)]
        [InlineData(3.5, 4)]
        [InlineData(3.9, 4)]
        [InlineData(-3.5, -4)]
        public void round_RoundsToNearest(double input, double expected)
        {
            Assert.Equal(expected, Math.round(input));
        }

        [Theory]
        [InlineData(4, 2)]
        [InlineData(9, 3)]
        [InlineData(16, 4)]
        public void sqrt_ReturnsSquareRoot(double input, double expected)
        {
            Assert.Equal(expected, Math.sqrt(input));
        }

        [Theory]
        [InlineData(2, 3, 8)]
        [InlineData(10, 2, 100)]
        [InlineData(5, 0, 1)]
        public void pow_RaisesPower(double x, double y, double expected)
        {
            Assert.Equal(expected, Math.pow(x, y));
        }

        [Fact]
        public void max_ReturnsMaximum()
        {
            Assert.Equal(5, Math.max(1, 3, 5, 2));
            Assert.Equal(10, Math.max(10));
        }

        [Fact]
        public void min_ReturnsMinimum()
        {
            Assert.Equal(1, Math.min(1, 3, 5, 2));
            Assert.Equal(10, Math.min(10));
        }

        [Fact]
        public void sin_ReturnsCorrectValue()
        {
            Assert.Equal(0, Math.sin(0), 10);
            Assert.Equal(1, Math.sin(Math.PI / 2), 10);
        }

        [Fact]
        public void cos_ReturnsCorrectValue()
        {
            Assert.Equal(1, Math.cos(0), 10);
            Assert.Equal(0, Math.cos(Math.PI / 2), 5);
        }

        [Fact]
        public void tan_ReturnsCorrectValue()
        {
            Assert.Equal(0, Math.tan(0), 10);
            Assert.Equal(1, Math.tan(Math.PI / 4), 10);
        }

        [Fact]
        public void asin_ReturnsCorrectValue()
        {
            Assert.Equal(0, Math.asin(0), 10);
            Assert.Equal(Math.PI / 2, Math.asin(1), 10);
        }

        [Fact]
        public void acos_ReturnsCorrectValue()
        {
            Assert.Equal(Math.PI / 2, Math.acos(0), 10);
            Assert.Equal(0, Math.acos(1), 10);
        }

        [Fact]
        public void atan_ReturnsCorrectValue()
        {
            Assert.Equal(0, Math.atan(0), 10);
            Assert.Equal(Math.PI / 4, Math.atan(1), 10);
        }

        [Fact]
        public void atan2_ReturnsCorrectValue()
        {
            Assert.Equal(Math.PI / 4, Math.atan2(1, 1), 10);
            Assert.Equal(Math.PI / 2, Math.atan2(1, 0), 10);
        }

        [Fact]
        public void exp_ReturnsCorrectValue()
        {
            Assert.Equal(1, Math.exp(0), 10);
            Assert.Equal(Math.E, Math.exp(1), 10);
        }

        [Fact]
        public void log_ReturnsNaturalLog()
        {
            Assert.Equal(0, Math.log(1), 10);
            Assert.Equal(1, Math.log(Math.E), 10);
        }

        [Fact]
        public void log10_ReturnsBase10Log()
        {
            Assert.Equal(0, Math.log10(1), 10);
            Assert.Equal(1, Math.log10(10), 10);
            Assert.Equal(2, Math.log10(100), 10);
        }

        [Fact]
        public void log2_ReturnsBase2Log()
        {
            Assert.Equal(0, Math.log2(1), 10);
            Assert.Equal(1, Math.log2(2), 10);
            Assert.Equal(3, Math.log2(8), 10);
        }

        [Fact]
        public void random_ReturnsBetweenZeroAndOne()
        {
            for (int i = 0; i < 100; i++)
            {
                var result = Math.random();
                Assert.True(result >= 0 && result < 1);
            }
        }

        [Theory]
        [InlineData(5, 1)]
        [InlineData(-5, -1)]
        [InlineData(0, 0)]
        public void sign_ReturnsSign(double input, double expected)
        {
            Assert.Equal(expected, Math.sign(input));
        }

        [Theory]
        [InlineData(3.7, 3)]
        [InlineData(-3.7, -3)]
        [InlineData(0, 0)]
        public void trunc_TruncatesDecimal(double input, double expected)
        {
            Assert.Equal(expected, Math.trunc(input));
        }

        // New method tests

        [Fact]
        public void sinh_CalculatesHyperbolicSine()
        {
            Assert.Equal(0, Math.sinh(0), 10);
            Assert.True(Math.sinh(1) > 1);
        }

        [Fact]
        public void cosh_CalculatesHyperbolicCosine()
        {
            Assert.Equal(1, Math.cosh(0), 10);
            Assert.True(Math.cosh(1) > 1);
        }

        [Fact]
        public void tanh_CalculatesHyperbolicTangent()
        {
            Assert.Equal(0, Math.tanh(0), 10);
            Assert.True(Math.tanh(1) > 0 && Math.tanh(1) < 1);
        }

        [Fact]
        public void asinh_CalculatesInverseHyperbolicSine()
        {
            Assert.Equal(0, Math.asinh(0), 10);
            var result = Math.asinh(1);
            Assert.True(result > 0.88 && result < 0.89);
        }

        [Fact]
        public void acosh_CalculatesInverseHyperbolicCosine()
        {
            Assert.Equal(0, Math.acosh(1), 10);
            var result = Math.acosh(2);
            Assert.True(result > 1.3 && result < 1.4);
        }

        [Fact]
        public void atanh_CalculatesInverseHyperbolicTangent()
        {
            Assert.Equal(0, Math.atanh(0), 10);
            var result = Math.atanh(0.5);
            Assert.True(result > 0.54 && result < 0.56);
        }

        [Theory]
        [InlineData(8, 2)]
        [InlineData(27, 3)]
        [InlineData(64, 4)]
        [InlineData(0, 0)]
        public void cbrt_CalculatesCubeRoot(double input, double expected)
        {
            Assert.Equal(expected, Math.cbrt(input), 10);
        }

        [Fact]
        public void hypot_CalculatesHypotenuse()
        {
            Assert.Equal(5, Math.hypot(3, 4), 10);
            Assert.Equal(13, Math.hypot(5, 12), 10);
        }

        [Theory]
        [InlineData(0, 0)]
        [InlineData(1, 1.718281828459045)]
        [InlineData(-1, -0.6321205588285577)]
        public void expm1_CalculatesExpMinusOne(double input, double expected)
        {
            Assert.Equal(expected, Math.expm1(input), 10);
        }

        [Theory]
        [InlineData(0, 0)]
        [InlineData(1, 0.6931471805599453)]
        [InlineData(2, 1.0986122886681098)]
        public void log1p_CalculatesLogOnePlus(double input, double expected)
        {
            Assert.Equal(expected, Math.log1p(input), 10);
        }

        [Fact]
        public void fround_RoundsToFloat32()
        {
            var result = Math.fround(1.337);
            Assert.InRange(result, 1.3369998931884766, 1.3370001068115234);
        }

        [Theory]
        [InlineData(2, 3, 6)]
        [InlineData(5, 12, 60)]
        [InlineData(-5, 12, -60)]
        public void imul_Multiplies32BitIntegers(int a, int b, int expected)
        {
            Assert.Equal(expected, Math.imul(a, b));
        }

        [Theory]
        [InlineData(1, 31)]
        [InlineData(4, 29)]
        [InlineData(0, 32)]
        public void clz32_CountsLeadingZeros(int input, int expected)
        {
            Assert.Equal(expected, Math.clz32(input));
        }

        [Fact]
        public void f16round_RoundsToFloat16()
        {
            var result = Math.f16round(1.5);
            Assert.Equal(1.5, result, 1);
        }
    }
}
