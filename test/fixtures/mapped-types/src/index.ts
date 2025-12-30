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

Console.writeLine(`Nullable name: ${np.name}`);
Console.writeLine(`Nullable age: ${np.age}`);
Console.writeLine(`Person name: ${p.name}`);
Console.writeLine(`Person age: ${p.age}`);
