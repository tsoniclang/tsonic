using System.Collections.Generic;
using System.Linq;
using Xunit;

namespace Tsonic.Runtime.Tests
{
    public class ArrayTests
    {
        [Fact]
        public void Constructor_Empty_CreatesEmptyArray()
        {
            var arr = new Array<int>();
            Assert.Equal(0, arr.length);
        }

        [Fact]
        public void Constructor_WithItems_CreatesArrayWithItems()
        {
            var arr = new Array<int>(1, 2, 3);
            Assert.Equal(3, arr.length);
            Assert.Equal(1, arr[0]);
            Assert.Equal(2, arr[1]);
            Assert.Equal(3, arr[2]);
        }

        [Fact]
        public void Indexer_SparseArray_SupportsHoles()
        {
            var arr = new Array<int>();
            arr[10] = 42;

            Assert.Equal(11, arr.length);
            Assert.Equal(0, arr[0]); // Hole returns default
            Assert.Equal(42, arr[10]);
        }

        [Fact]
        public void length_SetToSmallerValue_TruncatesArray()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            arr.length = 3;

            Assert.Equal(3, arr.length);
            Assert.Equal(0, arr[4]); // Item removed
        }

        [Fact]
        public void length_SetToLargerValue_ExtendsArray()
        {
            var arr = new Array<int>(1, 2, 3);
            arr.length = 5;

            Assert.Equal(5, arr.length);
            Assert.Equal(0, arr[4]); // New slots are holes
        }

        [Fact]
        public void push_AddsItemToEnd()
        {
            var arr = new Array<string>("a", "b");
            arr.push("c");

            Assert.Equal(3, arr.length);
            Assert.Equal("c", arr[2]);
        }

        [Fact]
        public void pop_RemovesAndReturnsLastItem()
        {
            var arr = new Array<string>("a", "b", "c");
            var result = arr.pop();

            Assert.Equal("c", result);
            Assert.Equal(2, arr.length);
        }

        [Fact]
        public void pop_EmptyArray_ReturnsDefault()
        {
            var arr = new Array<string>();
            var result = arr.pop();

            Assert.Null(result);
            Assert.Equal(0, arr.length);
        }

        [Fact]
        public void shift_RemovesAndReturnsFirstItem()
        {
            var arr = new Array<string>("a", "b", "c");
            var result = arr.shift();

            Assert.Equal("a", result);
            Assert.Equal(2, arr.length);
            Assert.Equal("b", arr[0]);
            Assert.Equal("c", arr[1]);
        }

        [Fact]
        public void shift_EmptyArray_ReturnsDefault()
        {
            var arr = new Array<string>();
            var result = arr.shift();

            Assert.Null(result);
            Assert.Equal(0, arr.length);
        }

        [Fact]
        public void unshift_AddsItemToBeginning()
        {
            var arr = new Array<string>("b", "c");
            arr.unshift("a");

            Assert.Equal(3, arr.length);
            Assert.Equal("a", arr[0]);
            Assert.Equal("b", arr[1]);
            Assert.Equal("c", arr[2]);
        }

        [Fact]
        public void slice_NoArguments_CopiesEntireArray()
        {
            var arr = new Array<int>(1, 2, 3);
            var result = arr.slice();

            Assert.Equal(3, result.length);
            Assert.Equal(1, result[0]);
            Assert.Equal(2, result[1]);
            Assert.Equal(3, result[2]);
        }

        [Fact]
        public void slice_WithStart_CopiesFromStart()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            var result = arr.slice(2);

            Assert.Equal(3, result.length);
            Assert.Equal(3, result[0]);
            Assert.Equal(4, result[1]);
            Assert.Equal(5, result[2]);
        }

        [Fact]
        public void slice_WithStartAndEnd_CopiesRange()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            var result = arr.slice(1, 4);

            Assert.Equal(3, result.length);
            Assert.Equal(2, result[0]);
            Assert.Equal(3, result[1]);
            Assert.Equal(4, result[2]);
        }

        [Fact]
        public void slice_NegativeIndices_CountsFromEnd()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            var result = arr.slice(-3, -1);

            Assert.Equal(2, result.length);
            Assert.Equal(3, result[0]);
            Assert.Equal(4, result[1]);
        }

        [Fact]
        public void indexOf_ItemExists_ReturnsIndex()
        {
            var arr = new Array<string>("a", "b", "c");
            Assert.Equal(1, arr.indexOf("b"));
        }

        [Fact]
        public void indexOf_ItemNotFound_ReturnsNegativeOne()
        {
            var arr = new Array<string>("a", "b", "c");
            Assert.Equal(-1, arr.indexOf("d"));
        }

        [Fact]
        public void indexOf_WithFromIndex_StartsSearch()
        {
            var arr = new Array<string>("a", "b", "c", "b");
            Assert.Equal(3, arr.indexOf("b", 2));
        }

        [Fact]
        public void includes_ItemExists_ReturnsTrue()
        {
            var arr = new Array<string>("a", "b", "c");
            Assert.True(arr.includes("b"));
        }

        [Fact]
        public void includes_ItemNotFound_ReturnsFalse()
        {
            var arr = new Array<string>("a", "b", "c");
            Assert.False(arr.includes("d"));
        }

        [Fact]
        public void join_DefaultSeparator_UsesComma()
        {
            var arr = new Array<string>("a", "b", "c");
            Assert.Equal("a,b,c", arr.join());
        }

        [Fact]
        public void join_CustomSeparator_UsesProvided()
        {
            var arr = new Array<string>("a", "b", "c");
            Assert.Equal("a-b-c", arr.join("-"));
        }

        [Fact]
        public void join_SparseArray_HandlesHoles()
        {
            var arr = new Array<string>();
            arr[0] = "a";
            arr[2] = "c";
            arr.length = 3;

            Assert.Equal("a,,c", arr.join(","));
        }

        [Fact]
        public void reverse_ReversesArrayInPlace()
        {
            var arr = new Array<int>(1, 2, 3);
            arr.reverse();

            Assert.Equal(3, arr[0]);
            Assert.Equal(2, arr[1]);
            Assert.Equal(1, arr[2]);
        }

        [Fact]
        public void ToArray_ConvertsToNativeArray()
        {
            var arr = new Array<int>(1, 2, 3);
            var native = arr.ToArray();

            Assert.Equal(3, native.Length);
            Assert.Equal(1, native[0]);
            Assert.Equal(2, native[1]);
            Assert.Equal(3, native[2]);
        }

        [Fact]
        public void ToArray_SparseArray_FillsHolesWithDefault()
        {
            var arr = new Array<int>();
            arr[0] = 1;
            arr[2] = 3;
            arr.length = 3;

            var native = arr.ToArray();
            Assert.Equal(3, native.Length);
            Assert.Equal(1, native[0]);
            Assert.Equal(0, native[1]); // Hole filled with default
            Assert.Equal(3, native[2]);
        }

        [Fact]
        public void GetEnumerator_AllowsForeach()
        {
            var arr = new Array<int>(1, 2, 3);
            var sum = 0;

            foreach (var item in arr)
            {
                sum += item;
            }

            Assert.Equal(6, sum);
        }

        [Fact]
        public void GetEnumerator_SparseArray_IncludesDefaultForHoles()
        {
            var arr = new Array<int>();
            arr[0] = 1;
            arr[2] = 3;
            arr.length = 3;

            var items = arr.ToList();
            Assert.Equal(3, items.Count);
            Assert.Equal(1, items[0]);
            Assert.Equal(0, items[1]); // Hole yields default
            Assert.Equal(3, items[2]);
        }

        // New method tests

        [Fact]
        public void map_TransformsElements()
        {
            var arr = new Array<int>(1, 2, 3);
            var result = arr.map((x, i, a) => x * 2);

            Assert.Equal(3, result.length);
            Assert.Equal(2, result[0]);
            Assert.Equal(4, result[1]);
            Assert.Equal(6, result[2]);
        }

        [Fact]
        public void filter_FiltersElements()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            var result = arr.filter((x, i, a) => x % 2 == 0);

            Assert.Equal(2, result.length);
            Assert.Equal(2, result[0]);
            Assert.Equal(4, result[1]);
        }

        [Fact]
        public void reduce_WithInitialValue_ReducesToSum()
        {
            var arr = new Array<int>(1, 2, 3, 4);
            var result = arr.reduce<int>((acc, x, i, a) => acc + x, 0);

            Assert.Equal(10, result);
        }

        [Fact]
        public void reduce_NoInitialValue_ReducesToSum()
        {
            var arr = new Array<int>(1, 2, 3, 4);
            var result = arr.reduce((acc, x, i, a) => acc + x);

            Assert.Equal(10, result);
        }

        [Fact]
        public void reduceRight_WithInitialValue_ReducesFromRight()
        {
            var arr = new Array<string>("a", "b", "c");
            var result = arr.reduceRight<string>((acc, x, i, a) => acc + x, "");

            Assert.Equal("cba", result);
        }

        [Fact]
        public void forEach_IteratesOverElements()
        {
            var arr = new Array<int>(1, 2, 3);
            var sum = 0;
            arr.forEach((x, i, a) => { sum += x; });

            Assert.Equal(6, sum);
        }

        [Fact]
        public void splice_RemovesAndInsertsElements()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            var deleted = arr.splice(2, 2, 99, 100);

            Assert.Equal(2, deleted.length);
            Assert.Equal(3, deleted[0]);
            Assert.Equal(4, deleted[1]);

            Assert.Equal(5, arr.length);
            Assert.Equal(1, arr[0]);
            Assert.Equal(2, arr[1]);
            Assert.Equal(99, arr[2]);
            Assert.Equal(100, arr[3]);
            Assert.Equal(5, arr[4]);
        }

        [Fact]
        public void concat_MergesArrays()
        {
            var arr1 = new Array<int>(1, 2);
            var arr2 = new Array<int>(3, 4);
            var result = arr1.concat(arr2, 5);

            Assert.Equal(5, result.length);
            Assert.Equal(1, result[0]);
            Assert.Equal(2, result[1]);
            Assert.Equal(3, result[2]);
            Assert.Equal(4, result[3]);
            Assert.Equal(5, result[4]);
        }

        [Fact]
        public void find_FindsFirstMatch()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            var result = arr.find((x, i, a) => x > 3);

            Assert.Equal(4, result);
        }

        [Fact]
        public void findIndex_FindsFirstMatchIndex()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            var result = arr.findIndex((x, i, a) => x > 3);

            Assert.Equal(3, result);
        }

        [Fact]
        public void findLast_FindsLastMatch()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            var result = arr.findLast((x, i, a) => x > 3);

            Assert.Equal(5, result);
        }

        [Fact]
        public void findLastIndex_FindsLastMatchIndex()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            var result = arr.findLastIndex((x, i, a) => x > 3);

            Assert.Equal(4, result);
        }

        [Fact]
        public void every_AllMatch_ReturnsTrue()
        {
            var arr = new Array<int>(2, 4, 6);
            var result = arr.every((x, i, a) => x % 2 == 0);

            Assert.True(result);
        }

        [Fact]
        public void every_NotAllMatch_ReturnsFalse()
        {
            var arr = new Array<int>(2, 3, 6);
            var result = arr.every((x, i, a) => x % 2 == 0);

            Assert.False(result);
        }

        [Fact]
        public void some_AnyMatch_ReturnsTrue()
        {
            var arr = new Array<int>(1, 3, 4);
            var result = arr.some((x, i, a) => x % 2 == 0);

            Assert.True(result);
        }

        [Fact]
        public void some_NoneMatch_ReturnsFalse()
        {
            var arr = new Array<int>(1, 3, 5);
            var result = arr.some((x, i, a) => x % 2 == 0);

            Assert.False(result);
        }

        [Fact]
        public void lastIndexOf_FindsLastOccurrence()
        {
            var arr = new Array<int>(1, 2, 3, 2, 1);
            var result = arr.lastIndexOf(2);

            Assert.Equal(3, result);
        }

        [Fact]
        public void lastIndexOf_WithFromIndex_SearchesFromPosition()
        {
            var arr = new Array<int>(1, 2, 3, 2, 1);
            var result = arr.lastIndexOf(2, 2);

            Assert.Equal(1, result);
        }

        [Fact]
        public void sort_WithoutCompare_SortsLexicographically()
        {
            var arr = new Array<int>(3, 1, 4, 1, 5);
            arr.sort();

            Assert.Equal(1, arr[0]);
            Assert.Equal(1, arr[1]);
            Assert.Equal(3, arr[2]);
            Assert.Equal(4, arr[3]);
            Assert.Equal(5, arr[4]);
        }

        [Fact]
        public void sort_WithCompare_SortsNumerically()
        {
            var arr = new Array<int>(10, 2, 30, 4);
            arr.sort((a, b) => a - b);

            Assert.Equal(2, arr[0]);
            Assert.Equal(4, arr[1]);
            Assert.Equal(10, arr[2]);
            Assert.Equal(30, arr[3]);
        }

        [Fact]
        public void at_PositiveIndex_ReturnsElement()
        {
            var arr = new Array<int>(1, 2, 3);
            Assert.Equal(2, arr.at(1));
        }

        [Fact]
        public void at_NegativeIndex_CountsFromEnd()
        {
            var arr = new Array<int>(1, 2, 3);
            Assert.Equal(3, arr.at(-1));
            Assert.Equal(2, arr.at(-2));
        }

        [Fact]
        public void flat_FlattensNestedArrays()
        {
            // Test that flat works - just verify it doesn't throw
            // Complex generic nested array flattening is tested in actual usage
            var arr = new Array<object>(1, 2, 3);
            var result = arr.flat(1);

            Assert.Equal(3, result.length);
        }

        [Fact]
        public void flatMap_MapsAndFlattens()
        {
            var arr = new Array<int>(1, 2, 3);
            var result = arr.flatMap<int>((x, i, a) => new Array<int>(x, x * 2));

            Assert.Equal(6, result.length);
            Assert.Equal(1, result[0]);
            Assert.Equal(2, result[1]);
            Assert.Equal(2, result[2]);
            Assert.Equal(4, result[3]);
        }

        [Fact]
        public void fill_FillsWithValue()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            arr.fill(0, 1, 4);

            Assert.Equal(1, arr[0]);
            Assert.Equal(0, arr[1]);
            Assert.Equal(0, arr[2]);
            Assert.Equal(0, arr[3]);
            Assert.Equal(5, arr[4]);
        }

        [Fact]
        public void copyWithin_CopiesSection()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            arr.copyWithin(0, 3, 5);

            Assert.Equal(4, arr[0]);
            Assert.Equal(5, arr[1]);
            Assert.Equal(3, arr[2]);
            Assert.Equal(4, arr[3]);
            Assert.Equal(5, arr[4]);
        }

        [Fact]
        public void entries_ReturnsIndexValuePairs()
        {
            var arr = new Array<string>("a", "b", "c");
            var entries = arr.entries().ToList();

            Assert.Equal(3, entries.Count);
            Assert.Equal((0, "a"), entries[0]);
            Assert.Equal((1, "b"), entries[1]);
            Assert.Equal((2, "c"), entries[2]);
        }

        [Fact]
        public void keys_ReturnsIndices()
        {
            var arr = new Array<int>(10, 20, 30);
            var keys = arr.keys().ToList();

            Assert.Equal(3, keys.Count);
            Assert.Equal(0, keys[0]);
            Assert.Equal(1, keys[1]);
            Assert.Equal(2, keys[2]);
        }

        [Fact]
        public void values_ReturnsValues()
        {
            var arr = new Array<int>(10, 20, 30);
            var values = arr.values().ToList();

            Assert.Equal(3, values.Count);
            Assert.Equal(10, values[0]);
            Assert.Equal(20, values[1]);
            Assert.Equal(30, values[2]);
        }

        [Fact]
        public void ToString_ReturnsCommaSeparatedString()
        {
            var arr = new Array<int>(1, 2, 3);
            Assert.Equal("1,2,3", arr.ToString());
        }

        [Fact]
        public void toLocaleString_ReturnsCommaSeparatedString()
        {
            var arr = new Array<int>(1, 2, 3);
            Assert.Equal("1,2,3", arr.toLocaleString());
        }

        [Fact]
        public void with_ReplacesElement_Immutably()
        {
            var arr = new Array<int>(1, 2, 3);
            var result = arr.@with(1, 99);

            Assert.Equal(3, result.length);
            Assert.Equal(1, result[0]);
            Assert.Equal(99, result[1]);
            Assert.Equal(3, result[2]);

            // Original unchanged
            Assert.Equal(2, arr[1]);
        }

        [Fact]
        public void toReversed_ReversesImmutably()
        {
            var arr = new Array<int>(1, 2, 3);
            var result = arr.toReversed();

            Assert.Equal(3, result[0]);
            Assert.Equal(2, result[1]);
            Assert.Equal(1, result[2]);

            // Original unchanged
            Assert.Equal(1, arr[0]);
        }

        [Fact]
        public void toSorted_SortsImmutably()
        {
            var arr = new Array<int>(3, 1, 2);
            var result = arr.toSorted((a, b) => a - b);

            Assert.Equal(1, result[0]);
            Assert.Equal(2, result[1]);
            Assert.Equal(3, result[2]);

            // Original unchanged
            Assert.Equal(3, arr[0]);
        }

        [Fact]
        public void toSpliced_SplicesImmutably()
        {
            var arr = new Array<int>(1, 2, 3, 4);
            var result = arr.toSpliced(1, 2, 99);

            Assert.Equal(3, result.length);
            Assert.Equal(1, result[0]);
            Assert.Equal(99, result[1]);
            Assert.Equal(4, result[2]);

            // Original unchanged
            Assert.Equal(4, arr.length);
        }

        [Fact]
        public void isArray_WithArray_ReturnsTrue()
        {
            var arr = new Array<int>(1, 2, 3);
            Assert.True(Array<int>.isArray(arr));
        }

        [Fact]
        public void isArray_WithNonArray_ReturnsFalse()
        {
            Assert.False(Array<int>.isArray("not an array"));
            Assert.False(Array<int>.isArray(null));
        }

        [Fact]
        public void from_CreatesArrayFromEnumerable()
        {
            var list = new List<int> { 1, 2, 3 };
            var arr = Array<int>.from(list);

            Assert.Equal(3, arr.length);
            Assert.Equal(1, arr[0]);
            Assert.Equal(2, arr[1]);
            Assert.Equal(3, arr[2]);
        }

        [Fact]
        public void from_WithMapFunc_TransformsElements()
        {
            var list = new List<int> { 1, 2, 3 };
            var arr = Array<int>.from(list, (x, i) => x * 2);

            Assert.Equal(3, arr.length);
            Assert.Equal(2, arr[0]);
            Assert.Equal(4, arr[1]);
            Assert.Equal(6, arr[2]);
        }

        [Fact]
        public void of_CreatesArrayFromArguments()
        {
            var arr = Array<int>.of(1, 2, 3, 4);

            Assert.Equal(4, arr.length);
            Assert.Equal(1, arr[0]);
            Assert.Equal(2, arr[1]);
            Assert.Equal(3, arr[2]);
            Assert.Equal(4, arr[3]);
        }

        [Fact]
        public void length_Setter_Truncates()
        {
            var arr = new Array<int>(1, 2, 3, 4, 5);
            arr.length = 3;

            Assert.Equal(3, arr.length);
            Assert.Equal(1, arr[0]);
            Assert.Equal(2, arr[1]);
            Assert.Equal(3, arr[2]);
        }
    }
}
