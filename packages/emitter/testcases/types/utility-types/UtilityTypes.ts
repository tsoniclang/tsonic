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

// Nested utility types
export type PartialReadonly = Partial<Readonly<Person>>;
export type ReadonlyPartial = Readonly<Partial<Person>>;

// Mixed optional and required
export interface MixedPerson {
  name: string;
  age?: number;
  email?: string;
}
export type FullMixedPerson = Required<MixedPerson>;
export type PartialMixedPerson = Partial<MixedPerson>;

// Pick from partial
export type PickFromPartial = Pick<Partial<Person>, "name" | "age">;

// Omit from readonly
export type OmitFromReadonly = Omit<Readonly<Person>, "email">;

// Interface with methods
export interface WithMethods {
  name: string;
  greet(greeting: string): string;
  calculate(a: number, b: number): number;
}
export type PartialWithMethods = Partial<WithMethods>;
export type ReadonlyWithMethods = Readonly<WithMethods>;
