using Xunit;

namespace Tsonic.Runtime.Tests
{
    public class JSONTests
    {
        public class TestPerson
        {
            public string? Name { get; set; }
            public int Age { get; set; }
        }

        public class TestData
        {
            public int Id { get; set; }
            public string? Value { get; set; }
            public bool IsActive { get; set; }
        }

        [Fact]
        public void stringify_SerializesObject()
        {
            var obj = new { name = "John", age = 30 };
            var json = JSON.stringify(obj);

            Assert.Contains("John", json);
            Assert.Contains("30", json);
        }

        [Fact]
        public void stringify_SerializesComplexObject()
        {
            var obj = new TestData
            {
                Id = 1,
                Value = "test",
                IsActive = true
            };

            var json = JSON.stringify(obj);

            Assert.Contains("1", json);
            Assert.Contains("test", json);
            Assert.Contains("true", json);
        }

        [Fact]
        public void parse_DeserializesObject()
        {
            var json = "{\"Name\":\"Alice\",\"Age\":25}";
            var result = JSON.parse<TestPerson>(json);

            Assert.Equal("Alice", result.Name);
            Assert.Equal(25, result.Age);
        }

        [Fact]
        public void parse_DeserializesComplexObject()
        {
            var json = "{\"Id\":42,\"Value\":\"data\",\"IsActive\":false}";
            var result = JSON.parse<TestData>(json);

            Assert.Equal(42, result.Id);
            Assert.Equal("data", result.Value);
            Assert.False(result.IsActive);
        }

        [Fact]
        public void stringify_HandlesNull()
        {
            var obj = new TestPerson { Name = null, Age = 0 };
            var json = JSON.stringify(obj);

            Assert.Contains("null", json);
        }

        [Fact]
        public void stringify_HandlesNumbers()
        {
            var obj = new { integer = 42, floating = 3.14, negative = -10 };
            var json = JSON.stringify(obj);

            Assert.Contains("42", json);
            Assert.Contains("3.14", json);
            Assert.Contains("-10", json);
        }

        [Fact]
        public void stringify_HandlesBooleans()
        {
            var obj = new { trueValue = true, falseValue = false };
            var json = JSON.stringify(obj);

            Assert.Contains("true", json);
            Assert.Contains("false", json);
        }

        [Fact]
        public void parse_HandlesEmptyObject()
        {
            var json = "{}";
            var result = JSON.parse<TestPerson>(json);

            Assert.Null(result.Name);
            Assert.Equal(0, result.Age);
        }

        [Fact]
        public void RoundTrip_PreservesData()
        {
            var original = new TestData
            {
                Id = 99,
                Value = "test data",
                IsActive = true
            };

            var json = JSON.stringify(original);
            var restored = JSON.parse<TestData>(json);

            Assert.Equal(original.Id, restored.Id);
            Assert.Equal(original.Value, restored.Value);
            Assert.Equal(original.IsActive, restored.IsActive);
        }
    }
}
