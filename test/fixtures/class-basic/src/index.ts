import { Console } from "@tsonic/dotnet/System";

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

Console.writeLine(person.greet());
Console.writeLine(`Age before: ${person.age}`);
person.birthday();
Console.writeLine(`Age after: ${person.age}`);
