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
            }
}
