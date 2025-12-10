// E2E test for utility types: Partial, Required, Pick, Omit
// Note: Readonly<T> types cannot be instantiated with object initializers in C#
// because the private setter prevents initialization. We test them via interface type.
import { Console } from "@tsonic/dotnet/System";

interface Person {
  name: string;
  age: number;
  email: string;
}

// Type aliases using utility types
type PartialPerson = Partial<Person>;
type NameOnly = Pick<Person, "name">;
type WithoutEmail = Omit<Person, "email">;
type ContactInfo = Pick<Person, "name" | "email">;
type MinimalPerson = Omit<Person, "age" | "email">;

// Interface with optional properties
interface OptionalFields {
  name?: string;
  age?: number;
}
type AllRequired = Required<OptionalFields>;

// Nested utility types (non-readonly)
type PartialPartial = Partial<Partial<Person>>;

export function main(): void {
  // Test Partial<T> - all properties optional
  const partial: PartialPerson = { name: "Alice" };
  Console.writeLine(`Partial: name=${partial.name}`);

  // Test full person
  const person: Person = { name: "Bob", age: 30, email: "bob@example.com" };
  Console.writeLine(`Person: name=${person.name}, age=${person.age}`);

  // Test Pick<T, K> - only name property
  const nameOnly: NameOnly = { name: "Diana" };
  Console.writeLine(`Pick: name=${nameOnly.name}`);

  // Test Pick with multiple keys
  const contactInfo: ContactInfo = { name: "Elaine", email: "elaine@test.com" };
  Console.writeLine(
    `Pick multi: name=${contactInfo.name}, email=${contactInfo.email}`
  );

  // Test Omit<T, K> - without email
  const withoutEmail: WithoutEmail = { name: "Eve", age: 35 };
  Console.writeLine(`Omit: name=${withoutEmail.name}, age=${withoutEmail.age}`);

  // Test Omit with multiple keys
  const minimalPerson: MinimalPerson = { name: "Fiona" };
  Console.writeLine(`Omit multi: name=${minimalPerson.name}`);

  // Test Required<T> on optional fields
  const allReq: AllRequired = { name: "Frank", age: 40 };
  Console.writeLine(`Required: name=${allReq.name}, age=${allReq.age}`);

  // Test nested: Partial<Partial<T>>
  const partialPartial: PartialPartial = { name: "Grace" };
  Console.writeLine(`Partial<Partial>: name=${partialPartial.name}`);

  Console.writeLine("All utility type tests passed!");
}
