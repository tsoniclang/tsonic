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
    }
}
