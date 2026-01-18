import { Console } from "@tsonic/dotnet/System.js";
import { trycast } from "@tsonic/core/lang.js";

class Person {
  public name: string;

  constructor(name: string) {
    this.name = name;
  }

  greet(): string {
    return `Hi ${this.name}`;
  }
}

export function main(): void {
  const u: unknown = new Person("Alice");

  // Cast receiver must be parenthesized before member access / invocation in C#:
  //   ((Person)u).name / ((Person)u).greet()
  const name1 = (u as Person).name;
  const greet1 = (u as Person).greet();

  // `as` (safe cast) receiver must also be parenthesized:
  //   (u as Person).name / (u as Person).greet()
  const name2 = trycast<Person>(u)!.name;
  const greet2 = trycast<Person>(u)!.greet();

  Console.WriteLine(name1);
  Console.WriteLine(greet1);
  Console.WriteLine(name2);
  Console.WriteLine(greet2);
}

