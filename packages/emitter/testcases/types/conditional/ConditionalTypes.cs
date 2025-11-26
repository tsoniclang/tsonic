using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace TestCases.types.conditional
{
        public static class ConditionalTypes
        {
            // type StringOrNumber = Union<string, double, bool>

            // type OnlyStrings = Extract<StringOrNumber, string>

            // type NoStrings = Exclude<StringOrNumber, string>

            // type NonNullableValue = NonNullable<string?>

            // type IsArray = dynamic

            // type ArrayCheck1 = IsArray<List<string>>

            // type ArrayCheck2 = IsArray<string>

            // type Unwrap = dynamic

            // type UnwrappedString = Unwrap<Task<string>>

            // type UnwrappedNumber = Unwrap<double>

            public static dynamic processValue<T>(T value)
                where T : Union<string, double>
                {
                if (Tsonic.Runtime.Operators.@typeof(value) == "string")
                    {
                    return value.length;
                    }
                return Tsonic.JSRuntime.Number.toString(value);
                }

            public static string greet(string name)
                {
                return $"Hello {name}";
                }

            // type GreetReturn = ReturnType<dynamic>
        }
}