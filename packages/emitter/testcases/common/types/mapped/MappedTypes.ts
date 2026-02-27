export interface Person {
  name: string;
  age: number;
}

export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

export type NullablePerson = Nullable<Person>;

export type ReadonlyPerson = {
  readonly [P in keyof Person]: Person[P];
};

export type PartialPerson = {
  [P in keyof Person]?: Person[P];
};
