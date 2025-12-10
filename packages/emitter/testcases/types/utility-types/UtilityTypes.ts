export interface Person {
  name: string;
  age: number;
  email: string;
}

// Partial<T> - makes all properties optional
export type PartialPerson = Partial<Person>;

// Required<T> - makes all properties required
export interface OptionalPerson {
  name?: string;
  age?: number;
}
export type RequiredOptionalPerson = Required<OptionalPerson>;

// Readonly<T> - makes all properties readonly
export type ReadonlyPerson = Readonly<Person>;

// Pick<T, K> - picks specified properties
export type PersonName = Pick<Person, "name">;
export type PersonContact = Pick<Person, "name" | "email">;

// Omit<T, K> - omits specified properties
export type PersonWithoutEmail = Omit<Person, "email">;
export type PersonNameOnly = Omit<Person, "age" | "email">;
