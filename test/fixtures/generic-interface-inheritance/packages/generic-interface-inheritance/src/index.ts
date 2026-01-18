import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Base interface
interface Identifiable<T> {
  id: T;
}

// Extending interface
interface Named<T> extends Identifiable<T> {
  name: string;
}

// Concrete implementation
class Person implements Named<int> {
  id: int;
  name: string;
  constructor(id: int, name: string) {
    this.id = id;
    this.name = name;
  }
}

// Generic implementation
class Item<T> implements Named<T> {
  id: T;
  name: string;
  constructor(id: T, name: string) {
    this.id = id;
    this.name = name;
  }
}

export function main(): void {
  const person = new Person(1, "Charlie");
  Console.WriteLine(`Person: ${person.id} - ${person.name}`);

  const item = new Item("SKU-001", "Widget");
  Console.WriteLine(`Item: ${item.id} - ${item.name}`);
}
