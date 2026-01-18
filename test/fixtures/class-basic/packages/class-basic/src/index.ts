import { Console } from "@tsonic/dotnet/System.js";

class Person {
  name!: string;
  age!: number;

  greet(): string {
    return `Hello, I'm ${this.name}`;
  }

  birthday(): void {
    this.age++;
  }
}

const person = new Person();
person.name = "Alice";
person.age = 25;

Console.WriteLine(person.greet());
Console.WriteLine(`Age before: ${person.age}`);
person.birthday();
Console.WriteLine(`Age after: ${person.age}`);
