using Xunit;

namespace Tsonic.Runtime.Tests
{
    public class StringTests
    {
        [Fact]
        public void toUpperCase_ConvertsToUpperCase()
        {
            Assert.Equal("HELLO", String.toUpperCase("hello"));
            Assert.Equal("WORLD123", String.toUpperCase("world123"));
        }

        [Fact]
        public void toLowerCase_ConvertsToLowerCase()
        {
            Assert.Equal("hello", String.toLowerCase("HELLO"));
            Assert.Equal("world123", String.toLowerCase("WORLD123"));
        }

        [Fact]
        public void trim_RemovesWhitespace()
        {
            Assert.Equal("hello", String.trim("  hello  "));
            Assert.Equal("hello", String.trim("\thello\n"));
        }

        [Fact]
        public void trimStart_RemovesLeadingWhitespace()
        {
            Assert.Equal("hello  ", String.trimStart("  hello  "));
        }

        [Fact]
        public void trimEnd_RemovesTrailingWhitespace()
        {
            Assert.Equal("  hello", String.trimEnd("  hello  "));
        }

        [Fact]
        public void substring_ExtractsSubstring()
        {
            Assert.Equal("llo", String.substring("hello", 2));
            Assert.Equal("ll", String.substring("hello", 2, 4));
        }

        [Fact]
        public void slice_ExtractsSlice()
        {
            Assert.Equal("llo", String.slice("hello", 2));
            Assert.Equal("ll", String.slice("hello", 2, 4));
        }

        [Fact]
        public void slice_NegativeIndices_CountsFromEnd()
        {
            Assert.Equal("lo", String.slice("hello", -2));
            Assert.Equal("ell", String.slice("hello", 1, -1));
        }

        [Fact]
        public void indexOf_FindsFirstOccurrence()
        {
            Assert.Equal(1, String.indexOf("hello", "e"));
            Assert.Equal(2, String.indexOf("hello", "ll"));
            Assert.Equal(-1, String.indexOf("hello", "x"));
        }

        [Fact]
        public void indexOf_WithPosition_StartsSearch()
        {
            Assert.Equal(4, String.indexOf("hello hello", "o", 3));
        }

        [Fact]
        public void lastIndexOf_FindsLastOccurrence()
        {
            Assert.Equal(10, String.lastIndexOf("hello hello", "o"));
            Assert.Equal(4, String.lastIndexOf("hello", "o"));
        }

        [Fact]
        public void startsWith_ChecksPrefix()
        {
            Assert.True(String.startsWith("hello", "hel"));
            Assert.False(String.startsWith("hello", "llo"));
        }

        [Fact]
        public void endsWith_ChecksSuffix()
        {
            Assert.True(String.endsWith("hello", "llo"));
            Assert.False(String.endsWith("hello", "hel"));
        }

        [Fact]
        public void includes_ChecksContains()
        {
            Assert.True(String.includes("hello world", "world"));
            Assert.False(String.includes("hello world", "goodbye"));
        }

        [Fact]
        public void replace_ReplacesOccurrences()
        {
            Assert.Equal("hi world", String.replace("hello world", "hello", "hi"));
            Assert.Equal("hxllo", String.replace("hello", "e", "x"));
        }

        [Fact]
        public void repeat_RepeatsString()
        {
            Assert.Equal("lalala", String.repeat("la", 3));
            Assert.Equal("", String.repeat("x", 0));
        }

        [Fact]
        public void padStart_PadsAtStart()
        {
            Assert.Equal("  hi", String.padStart("hi", 4));
            Assert.Equal("xxhi", String.padStart("hi", 4, "x"));
        }

        [Fact]
        public void padEnd_PadsAtEnd()
        {
            Assert.Equal("hi  ", String.padEnd("hi", 4));
            Assert.Equal("hixx", String.padEnd("hi", 4, "x"));
        }

        [Fact]
        public void charAt_GetsCharacter()
        {
            Assert.Equal("e", String.charAt("hello", 1));
            Assert.Equal("", String.charAt("hello", 10));
        }

        [Fact]
        public void charCodeAt_GetsCharCode()
        {
            Assert.Equal(101.0, String.charCodeAt("hello", 1)); // 'e'
            Assert.True(double.IsNaN(String.charCodeAt("hello", 10)));
        }

        [Fact]
        public void split_SplitsString()
        {
            var result = String.split("a,b,c", ",");
            Assert.Equal(3, result.length);
            Assert.Equal("a", result[0]);
            Assert.Equal("b", result[1]);
            Assert.Equal("c", result[2]);
        }

        [Fact]
        public void split_WithLimit_LimitsResults()
        {
            var result = String.split("a,b,c,d", ",", 2);
            Assert.Equal(2, result.length);
            Assert.Equal("a", result[0]);
            Assert.Equal("b", result[1]);
        }

        [Fact]
        public void length_ReturnsStringLength()
        {
            Assert.Equal(5, String.length("hello"));
            Assert.Equal(0, String.length(""));
        }
    }
}
