import { int } from "@tsonic/core/types.js";

// Base interface
export interface Identifiable<T> {
  id: T;
}

// Extending interface
export interface Named<T> extends Identifiable<T> {
  name: string;
}

// Concrete implementation
export class Person implements Named<int> {
  id: int;
  name: string;
  constructor(id: int, name: string) {
    this.id = id;
    this.name = name;
  }
}

// Generic implementation
export class Item<T> implements Named<T> {
  id: T;
  name: string;
  constructor(id: T, name: string) {
    this.id = id;
    this.name = name;
  }
}
