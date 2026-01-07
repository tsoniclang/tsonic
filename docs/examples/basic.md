# Basic Examples

Simple Tsonic programs to get started.

## Hello World

```typescript
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  Console.writeLine("Hello, Tsonic!");
}
```

## Variables

```typescript
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  const name = "Alice";
  const age = 30;
  const active = true;

  Console.writeLine(`${name} is ${age} years old`);
  Console.writeLine(`Active: ${active}`);
}
```

## Functions

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function greet(name: string): string {
  return `Hello, ${name}!`;
}

function add(a: number, b: number): number {
  return a + b;
}

export function main(): void {
  Console.writeLine(greet("Bob"));
  Console.writeLine(add(5, 3));
}
```

## Classes

```typescript
import { Console } from "@tsonic/dotnet/System.js";

class Person {
  private name: string;
  private age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  greet(): string {
    return `Hi, I'm ${this.name}`;
  }
}

export function main(): void {
  const person = new Person("Alice", 30);
  Console.writeLine(person.greet());
}
```

## Interfaces

```typescript
import { Console } from "@tsonic/dotnet/System.js";

interface User {
  id: number;
  name: string;
  email?: string;
}

function displayUser(user: User): void {
  Console.writeLine(`User: ${user.name} (${user.id})`);
  if (user.email) {
    Console.writeLine(`Email: ${user.email}`);
  }
}

export function main(): void {
  const user: User = {
    id: 1,
    name: "Bob",
    email: "bob@example.com",
  };
  displayUser(user);
}
```

## Control Flow

```typescript
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  // If/else
  const x = 10;
  if (x > 5) {
    Console.writeLine("Greater than 5");
  } else {
    Console.writeLine("5 or less");
  }

  // For loop
  for (let i = 0; i < 5; i++) {
    Console.writeLine(i);
  }

  // For-of loop
  const items = ["a", "b", "c"];
  for (const item of items) {
    Console.writeLine(item);
  }

  // While loop
  let count = 0;
  while (count < 3) {
    Console.writeLine(count);
    count++;
  }

  // Switch
  const value = 2;
  switch (value) {
    case 1:
      Console.writeLine("one");
      break;
    case 2:
      Console.writeLine("two");
      break;
    default:
      Console.writeLine("other");
  }
}
```

## Enums

```typescript
import { Console } from "@tsonic/dotnet/System.js";

enum Status {
  Pending,
  Active,
  Completed,
}

enum Color {
  Red = "red",
  Green = "green",
  Blue = "blue",
}

export function main(): void {
  const status = Status.Active;
  Console.writeLine(status); // 1

  const color = Color.Green;
  Console.writeLine(color); // "green"
}
```

## Generics

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function identity<T>(value: T): T {
  return value;
}

class Container<T> {
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  get(): T {
    return this.value;
  }
}

export function main(): void {
  const num = identity(42);
  const str = identity("hello");

  const box = new Container("contents");
  Console.writeLine(box.get());
}
```

## Tuples

```typescript
import { Console } from "@tsonic/dotnet/System.js";

// Fixed-length typed arrays
const point: [number, number] = [10, 20];
const record: [string, number, boolean] = ["Alice", 30, true];

export function main(): void {
  const [x, y] = point;
  Console.writeLine(`Point: ${x}, ${y}`);

  const [name, age, active] = record;
  Console.writeLine(`${name} is ${age} years old`);
}
```

## Dictionary and HashSet

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { Dictionary, HashSet } from "@tsonic/dotnet/System.Collections.Generic.js";

export function main(): void {
  // Dictionary<TKey, TValue> - key-value pairs
  const scores = new Dictionary<string, number>();
  scores.add("Alice", 100);
  scores.add("Bob", 85);
  Console.writeLine(scores.containsKey("Alice")); // true
  Console.writeLine(scores.count); // 2

  // HashSet<T> - unique values
  const tags = new HashSet<string>();
  tags.add("typescript");
  tags.add("native");
  tags.add("typescript"); // Ignored (duplicate)
  Console.writeLine(tags.count); // 2
}
```

## Anonymous Objects

```typescript
import { Console } from "@tsonic/dotnet/System.js";

// Simple objects auto-synthesize types
const point = { x: 10, y: 20 };
const config = { name: "app", debug: true };

// Arrow function properties work
const handler = {
  id: 1,
  process: (x: number): number => x * 2,
};

export function main(): void {
  Console.writeLine(point.x);
  Console.writeLine(handler.process(5)); // 10
}
```

## Type Guards

```typescript
import { Console } from "@tsonic/dotnet/System.js";

interface Dog {
  bark(): void;
}

interface Cat {
  meow(): void;
}

function isDog(pet: Dog | Cat): pet is Dog {
  return "bark" in pet;
}

export function main(): void {
  const pet: Dog | Cat = { bark: (): void => Console.writeLine("Woof!") };

  if (isDog(pet)) {
    pet.bark(); // TypeScript knows pet is Dog here
  }
}
```

## Async/Await

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";

async function delay(ms: number): Promise<void> {
  await Task.delay(ms);
}

async function fetchData(): Promise<string> {
  await delay(100);
  return "data";
}

export async function main(): Promise<void> {
  const data = await fetchData();
  Console.writeLine(data);
}
```

## Error Handling

```typescript
import { Console, Exception } from "@tsonic/dotnet/System.js";

function riskyOperation(): void {
  throw new Exception("Something went wrong");
}

export function main(): void {
  try {
    riskyOperation();
  } catch (error) {
    Console.writeLine("Caught error");
  } finally {
    Console.writeLine("Cleanup");
  }
}
```

## Integer Types

```typescript
import { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";

function sumRange(start: int, end: int): int {
  let total: int = 0;
  for (let i: int = start; i <= end; i = i + 1) {
    total = total + i;
  }
  return total;
}

export function main(): void {
  const a: int = 10;
  const b: int = 20;
  const sum: int = a + b; // Integer arithmetic

  Console.writeLine(`Sum: ${sum}`);
  Console.writeLine(`Range sum 1-10: ${sumRange(1, 10)}`);

  // Integer division truncates
  const x: int = 10;
  const y: int = 3;
  Console.writeLine(`10 / 3 = ${x / y}`); // 3 (not 3.333...)
}
```

> **See also:** [Numeric Types Guide](../numeric-types.md) for complete coverage.

## Callbacks

```typescript
import { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";

// Action<T> - no return value
function forEach(items: int[], action: (item: int) => void): void {
  for (const item of items) {
    action(item);
  }
}

// Func<T, TResult> - with return value
function map(items: int[], transform: (item: int) => int): int[] {
  const result: int[] = [];
  for (const item of items) {
    result.push(transform(item));
  }
  return result;
}

export function main(): void {
  const nums: int[] = [1, 2, 3];

  // Inline callback
  forEach(nums, (n: int) => {
    Console.writeLine(`Item: ${n}`);
  });

  // Transform callback
  const doubled = map(nums, (n: int) => n * 2);
  Console.writeLine(`Doubled: ${doubled}`);
}
```

> **See also:** [Callbacks Guide](../callbacks.md) for Action/Func patterns.
