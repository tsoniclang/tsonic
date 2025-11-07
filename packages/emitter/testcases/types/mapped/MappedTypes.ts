export interface Person {
  name: string;
  age: number;
  email: string;
}

// Using built-in utility types
export type PartialPerson = Partial<Person>;
export type RequiredPerson = Required<Person>;
export type ReadonlyPerson = Readonly<Person>;

// Custom mapped type
export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

export type NullablePerson = Nullable<Person>;

// Function using mapped types
export function updatePerson(
  person: Person,
  updates: Partial<Person>
): Person {
  return { ...person, ...updates };
}

// Function with readonly parameter
export function displayPerson(person: Readonly<Person>): string {
  return `${person.name} (${person.age})`;
}
