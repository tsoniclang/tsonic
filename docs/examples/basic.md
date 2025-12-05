# Basic Examples

Simple Tsonic programs to get started.

## Hello World

```typescript
// hello.ts
export function main(): void {
  console.log("Hello, Tsonic!");
}
```

```bash
tsonic build hello.ts
./hello
# Output: Hello, Tsonic!
```

## Variables

```typescript
export function main(): void {
  const name = "Alice";
  const age = 30;
  const active = true;

  console.log(`${name} is ${age} years old`);
  console.log(`Active: ${active}`);
}
```

## Functions

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}

function add(a: number, b: number): number {
  return a + b;
}

export function main(): void {
  console.log(greet("Bob"));
  console.log(add(5, 3));
}
```

## Classes

```typescript
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
  console.log(person.greet());
}
```

## Interfaces

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

function displayUser(user: User): void {
  console.log(`User: ${user.name} (${user.id})`);
  if (user.email) {
    console.log(`Email: ${user.email}`);
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
export function main(): void {
  // If/else
  const x = 10;
  if (x > 5) {
    console.log("Greater than 5");
  } else {
    console.log("5 or less");
  }

  // For loop
  for (let i = 0; i < 5; i++) {
    console.log(i);
  }

  // For-of loop
  const items = ["a", "b", "c"];
  for (const item of items) {
    console.log(item);
  }

  // While loop
  let count = 0;
  while (count < 3) {
    console.log(count);
    count++;
  }

  // Switch
  const value = 2;
  switch (value) {
    case 1:
      console.log("one");
      break;
    case 2:
      console.log("two");
      break;
    default:
      console.log("other");
  }
}
```

## Enums

```typescript
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
  console.log(status); // 1

  const color = Color.Green;
  console.log(color); // "green"
}
```

## Generics

```typescript
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
  console.log(box.get());
}
```

## Tuples

```typescript
// Fixed-length typed arrays
const point: [number, number] = [10, 20];
const record: [string, number, boolean] = ["Alice", 30, true];

export function main(): void {
  const [x, y] = point;
  console.log(`Point: ${x}, ${y}`);

  const [name, age, active] = record;
  console.log(`${name} is ${age} years old`);
}
```

## Map and Set

```typescript
export function main(): void {
  // Map - key-value pairs
  const scores = new Map<string, number>();
  scores.set("Alice", 100);
  scores.set("Bob", 85);
  console.log(scores.get("Alice")); // 100

  // Set - unique values
  const tags = new Set<string>();
  tags.add("typescript");
  tags.add("native");
  tags.add("typescript"); // Ignored (duplicate)
  console.log(tags.size); // 2
}
```

## Anonymous Objects

```typescript
// Simple objects auto-synthesize types
const point = { x: 10, y: 20 };
const config = { name: "app", debug: true };

// Arrow function properties work
const handler = {
  id: 1,
  process: (x: number): number => x * 2,
};

export function main(): void {
  console.log(point.x);
  console.log(handler.process(5)); // 10
}
```

## Type Guards

```typescript
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
  const pet: Dog | Cat = { bark: (): void => console.log("Woof!") };

  if (isDog(pet)) {
    pet.bark(); // TypeScript knows pet is Dog here
  }
}
```

## Async/Await

```typescript
async function delay(ms: number): Promise<void> {
  // Simulated delay
}

async function fetchData(): Promise<string> {
  await delay(100);
  return "data";
}

export async function main(): Promise<void> {
  const data = await fetchData();
  console.log(data);
}
```

## Error Handling

```typescript
function riskyOperation(): void {
  throw new Error("Something went wrong");
}

export function main(): void {
  try {
    riskyOperation();
  } catch (error) {
    console.log("Caught error");
  } finally {
    console.log("Cleanup");
  }
}
```
