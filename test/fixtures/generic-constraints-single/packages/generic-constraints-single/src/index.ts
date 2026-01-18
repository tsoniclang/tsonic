import { Console } from "@tsonic/dotnet/System.js";

interface Printable {
  ToString(): string;
}

class Printer<T extends Printable> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
  print(): void {
    Console.WriteLine(this.value.ToString());
  }
}

// Class that implements Printable
class Person implements Printable {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  ToString(): string {
    return `Person: ${this.name}`;
  }
}

export function main(): void {
  const printer = new Printer<Person>(new Person("Alice"));
  printer.print();
}
