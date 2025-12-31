/**
 * Interface and Type Declaration Tests
 *
 * Tests various interface patterns including:
 * - Simple interfaces
 * - Interfaces with methods
 * - Interfaces with optional properties
 * - Interface inheritance
 * - Generic interfaces
 * - Type aliases
 */

import { int, long, byte } from "@tsonic/core/types.js";

// Simple interface with primitive types
interface Point {
  x: int;
  y: int;
}

// Interface with multiple numeric types
interface Dimensions {
  width: int;
  height: int;
  depth: long;
}

// Interface with optional properties
interface Config {
  name: string;
  port: int;
  timeout?: int;
  retries?: byte;
}

// Interface with methods
interface Calculator {
  add(a: int, b: int): int;
  subtract(a: int, b: int): int;
  multiply(a: int, b: int): long;
}

// Interface inheritance
interface Shape {
  area(): int;
}

interface Rectangle extends Shape {
  width: int;
  height: int;
}

// Multiple inheritance
interface Named {
  name: string;
}

interface Colored {
  color: string;
}

interface NamedColoredShape extends Named, Colored, Shape {
  sides: int;
}

// Generic interface
interface Repository<T, K> {
  get(id: K): T | undefined;
  save(item: T): K;
  delete(id: K): boolean;
}

// Type alias for primitive
type UserId = int;
type Score = long;

// Type alias for object
type Person = {
  name: string;
  age: int;
  email: string;
};

// Type alias for generic
type StringMap<V> = {
  [key: string]: V;
};

// Type alias for union
type NumberOrString = int | string;
type OptionalInt = int | undefined;

// Test: Simple interface usage
function testSimpleInterface(): void {
  const point: Point = { x: 10 as int, y: 20 as int };
  const x: int = point.x;
  const y: int = point.y;
}

// Test: Interface with multiple numeric types
function testDimensions(): void {
  const dims: Dimensions = {
    width: 100 as int,
    height: 200 as int,
    depth: 50 as long,
  };
  const total: long = dims.width + dims.height + dims.depth;
}

// Test: Optional properties
function testOptionalProperties(): void {
  // Without optionals
  const config1: Config = {
    name: "server1",
    port: 8080 as int,
  };

  // With optionals
  const config2: Config = {
    name: "server2",
    port: 3000 as int,
    timeout: 5000 as int,
    retries: 3 as byte,
  };
}

// Test: Interface with methods (implemented as object)
function testInterfaceWithMethods(): void {
  const calc: Calculator = {
    add: (a: int, b: int): int => (a + b) as int,
    subtract: (a: int, b: int): int => (a - b) as int,
    multiply: (a: int, b: int): long => (a * b) as long,
  };

  const sum: int = calc.add(5 as int, 3 as int);
  const product: long = calc.multiply(10 as int, 20 as int);
}

// Test: Interface inheritance
function testInterfaceInheritance(): void {
  const rect: Rectangle = {
    width: 10 as int,
    height: 20 as int,
    area: (): int => (10 * 20) as int,
  };
  const a: int = rect.area();
}

// Test: Multiple inheritance
function testMultipleInheritance(): void {
  const shape: NamedColoredShape = {
    name: "Triangle",
    color: "red",
    sides: 3 as int,
    area: (): int => 100 as int,
  };
  const name: string = shape.name;
  const sides: int = shape.sides;
}

// Test: Type alias for primitives
function testTypeAlias(): void {
  const userId: UserId = 12345 as int;
  const score: Score = 9999999999 as long;
}

// Test: Type alias for objects
function testTypeAliasObject(): void {
  const person: Person = {
    name: "Alice",
    age: 30 as int,
    email: "alice@example.com",
  };
  const age: int = person.age;
}

// Test: Generic interface usage
function testGenericInterface(): void {
  const userRepo: Repository<Person, UserId> = {
    get: (id: UserId): Person | undefined => {
      return { name: "User", age: 25 as int, email: "user@example.com" };
    },
    save: (item: Person): UserId => 1 as int,
    delete: (id: UserId): boolean => true,
  };

  const user: Person | undefined = userRepo.get(1 as int);
}

// Test: Union type alias
function testUnionTypeAlias(): void {
  const value1: NumberOrString = 42 as int;
  const value2: NumberOrString = "hello";
  const maybe: OptionalInt = 10 as int;
  const nothing: OptionalInt = undefined;
}

// Read-only interface
interface Immutable {
  readonly id: int;
  readonly name: string;
  readonly timestamp: long;
}

// Test: Readonly properties
function testReadonlyInterface(): void {
  const item: Immutable = {
    id: 1 as int,
    name: "constant",
    timestamp: 1234567890 as long,
  };
  const id: int = item.id;
  // item.id = 2; // Would be a compile error
}

// Index signature interface
interface NumberDict {
  [key: string]: int;
}

// Test: Index signature
function testIndexSignature(): void {
  const scores: NumberDict = {
    alice: 100 as int,
    bob: 85 as int,
    charlie: 92 as int,
  };
  const aliceScore: int = scores["alice"];
}

export {
  testSimpleInterface,
  testDimensions,
  testOptionalProperties,
  testInterfaceWithMethods,
  testInterfaceInheritance,
  testMultipleInheritance,
  testTypeAlias,
  testTypeAliasObject,
  testGenericInterface,
  testUnionTypeAlias,
  testReadonlyInterface,
  testIndexSignature,
};
