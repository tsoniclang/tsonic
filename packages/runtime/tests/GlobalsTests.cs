using Xunit;

namespace Tsonic.Runtime.Tests
{
    public class GlobalsTests
    {
        [Theory]
        [InlineData("42", null, 42)]
        [InlineData("42", 10, 42)]
        [InlineData("101", 2, 5)]
        [InlineData("FF", 16, 255)]
        [InlineData("77", 8, 63)]
        [InlineData("  42  ", 10, 42)]
        public void parseInt_ValidInput_ReturnsCorrectValue(string input, int? radix, double expected)
        {
            var result = Globals.parseInt(input, radix);
            Assert.Equal(expected, result);
        }

        [Theory]
        [InlineData("", null)]
        [InlineData("   ", null)]
        [InlineData("abc", 10)]
        [InlineData("123", 1)]  // Invalid radix
        [InlineData("123", 37)] // Invalid radix
        public void parseInt_InvalidInput_ReturnsNaN(string input, int? radix)
        {
            var result = Globals.parseInt(input, radix);
            Assert.True(double.IsNaN(result));
        }

        [Theory]
        [InlineData("3.14", 3.14)]
        [InlineData("42", 42.0)]
        [InlineData("0.5", 0.5)]
        [InlineData("  3.14  ", 3.14)]
        [InlineData("3.14e2", 314.0)]
        public void parseFloat_ValidInput_ReturnsCorrectValue(string input, double expected)
        {
            var result = Globals.parseFloat(input);
            Assert.Equal(expected, result);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("abc")]
        public void parseFloat_InvalidInput_ReturnsNaN(string input)
        {
            var result = Globals.parseFloat(input);
            Assert.True(double.IsNaN(result));
        }

        [Fact]
        public void isNaN_WithNaN_ReturnsTrue()
        {
            Assert.True(Globals.isNaN(double.NaN));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(42)]
        [InlineData(-42)]
        [InlineData(3.14)]
        public void isNaN_WithNumbers_ReturnsFalse(double value)
        {
            Assert.False(Globals.isNaN(value));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(42)]
        [InlineData(-42)]
        [InlineData(3.14)]
        public void isFinite_WithFiniteNumbers_ReturnsTrue(double value)
        {
            Assert.True(Globals.isFinite(value));
        }

        [Fact]
        public void isFinite_WithInfinity_ReturnsFalse()
        {
            Assert.False(Globals.isFinite(double.PositiveInfinity));
            Assert.False(Globals.isFinite(double.NegativeInfinity));
        }

        [Fact]
        public void isFinite_WithNaN_ReturnsFalse()
        {
            Assert.False(Globals.isFinite(double.NaN));
        }

        [Fact]
        public void encodeURIComponent_EncodesSpecialCharacters()
        {
            var result = Globals.encodeURIComponent("hello world");
            Assert.Contains("hello", result);
            Assert.Contains("world", result);
        }

        [Fact]
        public void decodeURIComponent_DecodesEncodedString()
        {
            var encoded = Globals.encodeURIComponent("hello world");
            var decoded = Globals.decodeURIComponent(encoded);
            Assert.Equal("hello world", decoded);
        }

        [Fact]
        public void encodeURI_PreservesUriStructure()
        {
            var result = Globals.encodeURI("https://example.com/path with spaces");
            Assert.StartsWith("https://", result);
            Assert.Contains("example.com", result);
        }

        [Fact]
        public void decodeURI_DecodesEncodedUri()
        {
            var encoded = Globals.encodeURI("https://example.com/path with spaces");
            var decoded = Globals.decodeURI(encoded);
            Assert.Contains("path with spaces", decoded);
        }

        // New constants and type conversion tests

        [Fact]
        public void Infinity_IsPositiveInfinity()
        {
            Assert.True(double.IsPositiveInfinity(Globals.Infinity));
        }

        [Fact]
        public void NaN_IsNotANumber()
        {
            Assert.True(double.IsNaN(Globals.NaN));
        }

        [Fact]
        public void undefined_IsNull()
        {
            Assert.Null(Globals.undefined);
        }

        [Theory]
        [InlineData("123", 123)]
        [InlineData("45.67", 45.67)]
        [InlineData("0", 0)]
        public void Number_ParsesStringToNumber(string input, double expected)
        {
            Assert.Equal(expected, Globals.Number(input));
        }

        [Fact]
        public void Number_EmptyString_ReturnsZero()
        {
            Assert.Equal(0, Globals.Number(""));
            Assert.Equal(0, Globals.Number("   "));
        }

        [Fact]
        public void Number_Null_ReturnsZero()
        {
            Assert.Equal(0, Globals.Number(null));
        }

        [Theory]
        [InlineData(true, 1)]
        [InlineData(false, 0)]
        public void Number_Boolean_ReturnsNumeric(bool input, double expected)
        {
            Assert.Equal(expected, Globals.Number(input));
        }

        [Fact]
        public void Number_InvalidString_ReturnsNaN()
        {
            Assert.True(double.IsNaN(Globals.Number("not a number")));
        }

        [Fact]
        public void Number_InfinityString_ReturnsInfinity()
        {
            Assert.True(double.IsPositiveInfinity(Globals.Number("Infinity")));
            Assert.True(double.IsNegativeInfinity(Globals.Number("-Infinity")));
        }

        [Theory]
        [InlineData(null, "undefined")]
        [InlineData("hello", "hello")]
        [InlineData(123, "123")]
        [InlineData(true, "true")]
        [InlineData(false, "false")]
        public void String_ConvertsToString(object? input, string expected)
        {
            Assert.Equal(expected, Globals.String(input));
        }

        [Fact]
        public void String_NaN_ReturnsNaNString()
        {
            Assert.Equal("NaN", Globals.String(double.NaN));
        }

        [Fact]
        public void String_Infinity_ReturnsInfinityString()
        {
            Assert.Equal("Infinity", Globals.String(double.PositiveInfinity));
            Assert.Equal("-Infinity", Globals.String(double.NegativeInfinity));
        }

        [Theory]
        [InlineData(null, false)]
        [InlineData(true, true)]
        [InlineData(false, false)]
        [InlineData("", false)]
        [InlineData("hello", true)]
        [InlineData(0, false)]
        [InlineData(1, true)]
        [InlineData(42, true)]
        public void Boolean_ConvertsToBool(object? input, bool expected)
        {
            Assert.Equal(expected, Globals.Boolean(input));
        }

        [Fact]
        public void Boolean_NaN_ReturnsFalse()
        {
            Assert.False(Globals.Boolean(double.NaN));
        }

        [Fact]
        public void Boolean_Object_ReturnsTrue()
        {
            var obj = new { Name = "Test" };
            Assert.True(Globals.Boolean(obj));
        }
    }
}
