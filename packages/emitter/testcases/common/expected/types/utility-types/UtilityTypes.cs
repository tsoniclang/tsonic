namespace TestCases.common.types.utilitytypes
{
    public class Person
    {
        public required string Name { get; set; }

        public required double Age { get; set; }

        public required string Email { get; set; }
    }
    public class OptionalPerson
    {
        public string? Name { get; set; }

        public double? Age { get; set; }
    }
    public class MixedPerson
    {
        public required string Name { get; set; }

        public double? Age { get; set; }

        public string? Email { get; set; }
    }
    public interface WithMethods
    {
        string Name { get; set; }

        string Greet(string greeting);

        double Calculate(double a, double b);
    }

        public static class UtilityTypes
        {
            public sealed class PartialPerson__Alias
            {
                public string? Name { get; set; }
                public double? Age { get; set; }
                public string? Email { get; set; }
            }

            public sealed class RequiredOptionalPerson__Alias
            {
                public required string Name { get; set; }
                public required double Age { get; set; }
            }

            public sealed class ReadonlyPerson__Alias
            {
                public required string Name { get; }
                public required double Age { get; }
                public required string Email { get; }
            }

            public sealed class PersonName__Alias
            {
                public required string Name { get; set; }
            }

            public sealed class PersonContact__Alias
            {
                public required string Name { get; set; }
                public required string Email { get; set; }
            }

            public sealed class PersonWithoutEmail__Alias
            {
                public required string Name { get; set; }
                public required double Age { get; set; }
            }

            public sealed class PersonNameOnly__Alias
            {
                public required string Name { get; set; }
            }

            public sealed class PartialReadonly__Alias
            {
                public string? Name { get; }
                public double? Age { get; }
                public string? Email { get; }
            }

            public sealed class ReadonlyPartial__Alias
            {
                public string? Name { get; }
                public double? Age { get; }
                public string? Email { get; }
            }

            public sealed class FullMixedPerson__Alias
            {
                public required string Name { get; set; }
                public required double Age { get; set; }
                public required string Email { get; set; }
            }

            public sealed class PartialMixedPerson__Alias
            {
                public string? Name { get; set; }
                public double? Age { get; set; }
                public string? Email { get; set; }
            }

            public sealed class PickFromPartial__Alias
            {
                public string? Name { get; set; }
                public double? Age { get; set; }
            }

            public sealed class OmitFromReadonly__Alias
            {
                public required string Name { get; }
                public required double Age { get; }
            }

            public sealed class PartialWithMethods__Alias
            {
                public string? Name { get; set; }
            }

            public sealed class ReadonlyWithMethods__Alias
            {
                public required string Name { get; }
            }

            // type MaybeString = string?

            // type DefiniteString = string

            // type MaybeNumber = double?

            // type DefiniteNumber = double

            // type StringOrNumber = global::Tsonic.Runtime.Union<string, double>

            // type OnlyString = string

            // type OnlyNumber = double

            // type Literals = global::Tsonic.Runtime.Union<string, string, string>

            // type WithoutA = global::Tsonic.Runtime.Union<string, string>

            // type ExtractedString = string

            // type ExtractedNumber = double

            public sealed class StatusMap__Alias
            {
                public required bool Pending { get; set; }
                public required bool Active { get; set; }
                public required bool Done { get; set; }
            }

            public sealed class NumericKeys__Alias
            {
                public required string 1 { get; set; }
                public required string 2 { get; set; }
                public required string 3 { get; set; }
            }
        }
}