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

        // New method tests

        [Fact]
        public void at_PositiveIndex_ReturnsCharacter()
        {
            Assert.Equal("e", String.at("hello", 1));
            Assert.Equal("o", String.at("hello", 4));
        }

        [Fact]
        public void at_NegativeIndex_CountsFromEnd()
        {
            Assert.Equal("o", String.at("hello", -1));
            Assert.Equal("l", String.at("hello", -2));
        }

        [Fact]
        public void codePointAt_ReturnsCodePoint()
        {
            Assert.Equal(104, String.codePointAt("hello", 0)); // 'h'
            Assert.Equal(101, String.codePointAt("hello", 1)); // 'e'
        }

        [Fact]
        public void concat_ConcatenatesStrings()
        {
            Assert.Equal("helloworld", String.concat("hello", "world"));
            Assert.Equal("abc", String.concat("a", "b", "c"));
        }

        [Fact]
        public void localeCompare_ComparesStrings()
        {
            Assert.True(String.localeCompare("a", "b") < 0);
            Assert.True(String.localeCompare("b", "a") > 0);
            Assert.Equal(0, String.localeCompare("a", "a"));
        }

        [Fact]
        public void match_FindsPattern()
        {
            var result = String.match("hello world", "wor");
            Assert.NotNull(result);
            Assert.Equal("wor", result[0]);
        }

        [Fact]
        public void match_NoMatch_ReturnsNull()
        {
            var result = String.match("hello", "xyz");
            Assert.Null(result);
        }

        [Fact]
        public void matchAll_FindsAllMatches()
        {
            var result = String.matchAll("test test test", "test");
            Assert.Equal(3, result.length);
        }

        [Fact]
        public void search_FindsPatternIndex()
        {
            Assert.Equal(6, String.search("hello world", "world"));
            Assert.Equal(-1, String.search("hello", "xyz"));
        }

        [Fact]
        public void replaceAll_ReplacesAllOccurrences()
        {
            Assert.Equal("hi hi hi", String.replaceAll("hello hello hello", "hello", "hi"));
        }

        [Fact]
        public void normalize_NormalizesUnicode()
        {
            var str = "\u00e9"; // é
            var normalized = String.normalize(str, "NFC");
            Assert.NotNull(normalized);
        }

        [Fact]
        public void substr_ExtractsSubstring()
        {
            Assert.Equal("llo", String.substr("hello", 2));
            Assert.Equal("ll", String.substr("hello", 2, 2));
        }

        [Fact]
        public void substr_NegativeStart_CountsFromEnd()
        {
            Assert.Equal("lo", String.substr("hello", -2));
        }

        [Fact]
        public void toLocaleLowerCase_ConvertsToLowerCase()
        {
            Assert.Equal("hello", String.toLocaleLowerCase("HELLO"));
        }

        [Fact]
        public void toLocaleUpperCase_ConvertsToUpperCase()
        {
            Assert.Equal("HELLO", String.toLocaleUpperCase("hello"));
        }

        [Fact]
        public void toString_ReturnsString()
        {
            Assert.Equal("hello", String.toString("hello"));
        }

        [Fact]
        public void valueOf_ReturnsString()
        {
            Assert.Equal("hello", String.valueOf("hello"));
        }

        [Fact]
        public void isWellFormed_WellFormedString_ReturnsTrue()
        {
            Assert.True(String.isWellFormed("hello"));
        }

        [Fact]
        public void isWellFormed_IllFormedString_ReturnsFalse()
        {
            // High surrogate without low surrogate
            var illFormed = "\ud800";
            Assert.False(String.isWellFormed(illFormed));
        }

        [Fact]
        public void toWellFormed_FixesIllFormedString()
        {
            var illFormed = "\ud800"; // High surrogate alone
            var wellFormed = String.toWellFormed(illFormed);
            Assert.NotEqual(illFormed, wellFormed);
            Assert.True(String.isWellFormed(wellFormed));
        }

        [Fact]
        public void trimLeft_RemovesLeadingWhitespace()
        {
            Assert.Equal("hello  ", String.trimLeft("  hello  "));
        }

        [Fact]
        public void trimRight_RemovesTrailingWhitespace()
        {
            Assert.Equal("  hello", String.trimRight("  hello  "));
        }

        [Fact]
        public void fromCharCode_CreatesStringFromCharCodes()
        {
            Assert.Equal("ABC", String.fromCharCode(65, 66, 67));
        }

        [Fact]
        public void fromCodePoint_CreatesStringFromCodePoints()
        {
            Assert.Equal("ABC", String.fromCodePoint(65, 66, 67));
        }

        [Fact]
        public void raw_CreatesRawTemplateString()
        {
            var template = new Array<string>("Hello ", " world", "!");
            Assert.Equal("Hello X world!", String.raw(template, "X"));
        }
    }
}
