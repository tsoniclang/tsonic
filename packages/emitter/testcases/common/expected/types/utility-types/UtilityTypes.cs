// Generated from: UtilityTypes.ts
// Generated at: 2026-02-25T03:01:05.242Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.utilitytypes
{
    public class Person
    {
        public required string name { get; set; }
        public required double age { get; set; }
        public required string email { get; set; }
    }
    public sealed class PartialPerson__Alias
    {
        public string? name { get; set; }
        public double? age { get; set; }
        public string? email { get; set; }
    }
    public class OptionalPerson
    {
        public string? name { get; set; }
        public double? age { get; set; }
    }
    public sealed class RequiredOptionalPerson__Alias
    {
        public required string name { get; set; }
        public required double age { get; set; }
    }
    public sealed class ReadonlyPerson__Alias
    {
        public required string name { get; init; }
        public required double age { get; init; }
        public required string email { get; init; }
    }
    public sealed class PersonName__Alias
    {
        public required string name { get; set; }
    }
    public sealed class PersonContact__Alias
    {
        public required string name { get; set; }
        public required string email { get; set; }
    }
    public sealed class PersonWithoutEmail__Alias
    {
        public required string name { get; set; }
        public required double age { get; set; }
    }
    public sealed class PersonNameOnly__Alias
    {
        public required string name { get; set; }
    }
    public sealed class PartialReadonly__Alias
    {
        public string? name { get; init; }
        public double? age { get; init; }
        public string? email { get; init; }
    }
    public sealed class ReadonlyPartial__Alias
    {
        public string? name { get; init; }
        public double? age { get; init; }
        public string? email { get; init; }
    }
    public class MixedPerson
    {
        public required string name { get; set; }
        public double? age { get; set; }
        public string? email { get; set; }
    }
    public sealed class FullMixedPerson__Alias
    {
        public required string name { get; set; }
        public required double age { get; set; }
        public required string email { get; set; }
    }
    public sealed class PartialMixedPerson__Alias
    {
        public string? name { get; set; }
        public double? age { get; set; }
        public string? email { get; set; }
    }
    public sealed class PickFromPartial__Alias
    {
        public string? name { get; set; }
        public double? age { get; set; }
    }
    public sealed class OmitFromReadonly__Alias
    {
        public required string name { get; init; }
        public required double age { get; init; }
    }
    public interface WithMethods
    {
        string name { get; set; }
        string greet(string greeting);
        double calculate(double a, double b);
    }
    public sealed class PartialWithMethods__Alias
    {
        public string? name { get; set; }
    }
    public sealed class ReadonlyWithMethods__Alias
    {
        public required string name { get; init; }
    }
    public sealed class StatusMap__Alias
    {
        public required bool pending { get; set; }
        public required bool active { get; set; }
        public required bool done { get; set; }
    }
    public sealed class NumericKeys__Alias
    {
        public required string _1 { get; set; }
        public required string _2 { get; set; }
        public required string _3 { get; set; }
    }

    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class UtilityTypes
    {
        // type MaybeString = string?

        // type DefiniteString = string

        // type MaybeNumber = double?

        // type DefiniteNumber = double

        // type StringOrNumber = global::Tsonic.Runtime.Union<string, double>

        // type OnlyString = string

        // type OnlyNumber = double

        // type Literals = string

        // type WithoutA = string

        // type ExtractedString = string

        // type ExtractedNumber = double
    }
}