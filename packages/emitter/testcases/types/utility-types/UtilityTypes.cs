namespace TestCases.types.utilitytypes
{
    public class Person
    {
        public string name { get; set; }

        public double age { get; set; }

        public string email { get; set; }
    }
    public class OptionalPerson
    {
        public string? name { get; set; }

        public double? age { get; set; }
    }
    public class MixedPerson
    {
        public string name { get; set; }

        public double? age { get; set; }

        public string? email { get; set; }
    }
    public class WithMethods
    {
        public string name { get; set; }

        public string greet(string greeting) => throw new NotImplementedException();

        public double calculate(double a, double b) => throw new NotImplementedException();
    }

            public static class UtilityTypes
            {
                public sealed class PartialPerson__Alias
                {
                    public string? name { get; set; } = default!;
                    public double? age { get; set; } = default!;
                    public string? email { get; set; } = default!;
                }

                public sealed class RequiredOptionalPerson__Alias
                {
                    public string name { get; set; } = default!;
                    public double age { get; set; } = default!;
                }

                public sealed class ReadonlyPerson__Alias
                {
                    public string name { get; private set; } = default!;
                    public double age { get; private set; } = default!;
                    public string email { get; private set; } = default!;
                }

                public sealed class PersonName__Alias
                {
                    public string name { get; set; } = default!;
                }

                public sealed class PersonContact__Alias
                {
                    public string name { get; set; } = default!;
                    public string email { get; set; } = default!;
                }

                public sealed class PersonWithoutEmail__Alias
                {
                    public string name { get; set; } = default!;
                    public double age { get; set; } = default!;
                }

                public sealed class PersonNameOnly__Alias
                {
                    public string name { get; set; } = default!;
                }

                public sealed class PartialReadonly__Alias
                {
                    public string? name { get; private set; } = default!;
                    public double? age { get; private set; } = default!;
                    public string? email { get; private set; } = default!;
                }

                public sealed class ReadonlyPartial__Alias
                {
                    public string? name { get; private set; } = default!;
                    public double? age { get; private set; } = default!;
                    public string? email { get; private set; } = default!;
                }

                public sealed class FullMixedPerson__Alias
                {
                    public string name { get; set; } = default!;
                    public double age { get; set; } = default!;
                    public string email { get; set; } = default!;
                }

                public sealed class PartialMixedPerson__Alias
                {
                    public string? name { get; set; } = default!;
                    public double? age { get; set; } = default!;
                    public string? email { get; set; } = default!;
                }

                public sealed class PickFromPartial__Alias
                {
                    public string? name { get; set; } = default!;
                    public double? age { get; set; } = default!;
                }

                public sealed class OmitFromReadonly__Alias
                {
                    public string name { get; private set; } = default!;
                    public double age { get; private set; } = default!;
                }

                public sealed class PartialWithMethods__Alias
                {
                    public string? name { get; set; } = default!;
                }

                public sealed class ReadonlyWithMethods__Alias
                {
                    public string name { get; private set; } = default!;
                }

                // type MaybeString = string?

                // type DefiniteString = string

                // type MaybeNumber = double?

                // type DefiniteNumber = double

                // type StringOrNumber = global::Tsonic.Runtime.Union<string, double>

                // type OnlyString = string

                // type OnlyNumber = double

                // type Literals = global::Tsonic.Runtime.Union<string, string, string>

                // type WithoutA = WithoutA

                // type ExtractedString = string

                // type ExtractedNumber = double

                public sealed class StatusMap__Alias
                {
                    public bool pending { get; set; } = default!;
                    public bool active { get; set; } = default!;
                    public bool done { get; set; } = default!;
                }

                public sealed class NumericKeys__Alias
                {
                    public string 1 { get; set; } = default!;
                    public string 2 { get; set; } = default!;
                    public string 3 { get; set; } = default!;
                }
            }
}