export interface Person {
  name: string;
  age: number;
}

// Custom mapped type - still not supported
export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

export type NullablePerson = Nullable<Person>;
