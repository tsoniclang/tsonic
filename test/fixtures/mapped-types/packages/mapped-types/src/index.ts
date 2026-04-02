import { Console } from "@tsonic/dotnet/System.js";

interface Person {
  name: string;
  age: number;
}

type NullableProps<T> = {
  [K in keyof T]: T[K] | undefined;
};

type NullablePerson = NullableProps<Person>;

function acceptNullablePerson(_value: NullablePerson): void {}

const person: NullablePerson = { name: "Alice", age: 30 };
acceptNullablePerson(person);

Console.WriteLine("mapped ok");
