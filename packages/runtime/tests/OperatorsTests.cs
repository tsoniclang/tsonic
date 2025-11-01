using System;
using Xunit;

namespace Tsonic.Runtime.Tests
{
    public class OperatorsTests
    {
        [Fact]
        public void typeof_Null_ReturnsUndefined()
        {
            Assert.Equal("undefined", Operators.@typeof(null));
        }

        [Fact]
        public void typeof_String_ReturnsString()
        {
            Assert.Equal("string", Operators.@typeof("hello"));
            Assert.Equal("string", Operators.@typeof(""));
        }

        [Theory]
        [InlineData(42)]
        [InlineData(3.14)]
        [InlineData(0)]
        [InlineData(-10)]
        public void typeof_Numbers_ReturnsNumber(object value)
        {
            Assert.Equal("number", Operators.@typeof(value));
        }

        [Fact]
        public void typeof_Double_ReturnsNumber()
        {
            Assert.Equal("number", Operators.@typeof(42.0));
            Assert.Equal("number", Operators.@typeof(3.14));
        }

        [Fact]
        public void typeof_Int_ReturnsNumber()
        {
            Assert.Equal("number", Operators.@typeof(42));
        }

        [Fact]
        public void typeof_Float_ReturnsNumber()
        {
            Assert.Equal("number", Operators.@typeof(3.14f));
        }

        [Fact]
        public void typeof_Long_ReturnsNumber()
        {
            Assert.Equal("number", Operators.@typeof(123456789L));
        }

        [Fact]
        public void typeof_Decimal_ReturnsNumber()
        {
            Assert.Equal("number", Operators.@typeof(19.99m));
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public void typeof_Boolean_ReturnsBoolean(bool value)
        {
            Assert.Equal("boolean", Operators.@typeof(value));
        }

        [Fact]
        public void typeof_Delegate_ReturnsFunction()
        {
            Action func = () => { };
            Assert.Equal("function", Operators.@typeof(func));
        }

        [Fact]
        public void typeof_Func_ReturnsFunction()
        {
            Func<int> func = () => 42;
            Assert.Equal("function", Operators.@typeof(func));
        }

        [Fact]
        public void typeof_Object_ReturnsObject()
        {
            var obj = new { name = "test" };
            Assert.Equal("object", Operators.@typeof(obj));
        }

        [Fact]
        public void typeof_Array_ReturnsObject()
        {
            var arr = new Array<int>();
            Assert.Equal("object", Operators.@typeof(arr));
        }

        [Fact]
        public void instanceof_NullObject_ReturnsFalse()
        {
            Assert.False(Operators.instanceof(null, typeof(string)));
        }

        [Fact]
        public void instanceof_MatchingType_ReturnsTrue()
        {
            var str = "hello";
            Assert.True(Operators.instanceof(str, typeof(string)));
        }

        [Fact]
        public void instanceof_DifferentType_ReturnsFalse()
        {
            var str = "hello";
            Assert.False(Operators.instanceof(str, typeof(int)));
        }

        [Fact]
        public void instanceof_SubclassType_ReturnsTrue()
        {
            var arr = new Array<int>();
            Assert.True(Operators.instanceof(arr, typeof(Array<int>)));
        }

        [Fact]
        public void instanceof_BaseType_ReturnsTrue()
        {
            var arr = new Array<int>();
            Assert.True(Operators.instanceof(arr, typeof(object)));
        }

        public class TestBase { }
        public class TestDerived : TestBase { }

        [Fact]
        public void instanceof_DerivedClass_ReturnsTrueForBase()
        {
            var obj = new TestDerived();
            Assert.True(Operators.instanceof(obj, typeof(TestBase)));
        }

        [Fact]
        public void instanceof_DerivedClass_ReturnsTrueForDerived()
        {
            var obj = new TestDerived();
            Assert.True(Operators.instanceof(obj, typeof(TestDerived)));
        }

        [Fact]
        public void instanceof_BaseClass_ReturnsFalseForDerived()
        {
            var obj = new TestBase();
            Assert.False(Operators.instanceof(obj, typeof(TestDerived)));
        }
    }
}
