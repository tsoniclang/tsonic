import { Console } from "@tsonic/dotnet/System.js";

interface Person {
  name: string;
  age: number;
}

// Custom mapped type
type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

type NullablePerson = Nullable<Person>;

function createNullablePerson(): NullablePerson {
  return { name: null, age: null };
}

function createPerson(): NullablePerson {
  return { name: "Alice", age: 30 };
}

const np = createNullablePerson();
const p = createPerson();

Console.WriteLine(`Nullable name: ${np.name}`);
Console.WriteLine(`Nullable age: ${np.age}`);
Console.WriteLine(`Person name: ${p.name}`);
Console.WriteLine(`Person age: ${p.age}`);
