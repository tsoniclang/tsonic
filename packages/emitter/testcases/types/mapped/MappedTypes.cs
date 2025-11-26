using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.types.mapped
{
    public class Person
    {
        public string name { get; set; }

        public double age { get; set; }

        public string email { get; set; }
    }

            public static class MappedTypes
            {
                // type PartialPerson = Partial<Person>

                // type RequiredPerson = Required<Person>

                // type ReadonlyPerson = Readonly<Person>

                // type Nullable = dynamic

                // type NullablePerson = Nullable<Person>

                public static Person updatePerson(Person person, Partial<Person> updates)
                    {
                    return new { /* ...spread */, /* ...spread */ };
                    }

                public static string displayPerson(Readonly<Person> person)
                    {
                    return $"{person.name} ({person.age})";
                    }
            }
}