import { int } from "@tsonic/core/types.js";

// Base class
export class Identifiable<T> {
  id: T;
  constructor(id: T) {
    this.id = id;
  }
}

// Extending class
export class Named<T> extends Identifiable<T> {
  name: string;
  constructor(id: T, name: string) {
    super(id);
    this.name = name;
  }
}

// Concrete subclass
export class Person extends Named<int> {
  constructor(id: int, name: string) {
    super(id, name);
  }
}

// Generic subclass
export class Item<T> extends Named<T> {
  constructor(id: T, name: string) {
    super(id, name);
  }
}
