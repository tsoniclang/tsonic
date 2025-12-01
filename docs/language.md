# Language Guide

Tsonic supports a subset of TypeScript designed for compilation to native code.

## Supported Features

### Variables and Constants

```typescript
const name = "Alice";
const age: number = 30;
let count = 0;
```

### Functions

```typescript
// Function declarations
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Arrow functions
const double = (n: number): number => n * 2;

// Async functions
export async function fetchData(): Promise<string> {
  return await someAsyncOperation();
}
```

### Classes

```typescript
export class Person {
  private name: string;
  private age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  public greet(): string {
    return `Hello, I'm ${this.name}`;
  }

  public static create(name: string): Person {
    return new Person(name, 0);
  }
}
```

### Interfaces

```typescript
export interface User {
  id: number;
  name: string;
  email?: string;
}

export interface Repository<T> {
  get(id: number): T | null;
  save(item: T): void;
}
```

### Type Aliases

```typescript
export type UserId = number;
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type Callback = (value: number) => void;
```

### Enums

```typescript
export enum Status {
  Pending,
  Active,
  Completed
}

export enum Color {
  Red = "red",
  Green = "green",
  Blue = "blue"
}
```

### Generics

```typescript
export function identity<T>(value: T): T {
  return value;
}

export class Container<T> {
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  get(): T {
    return this.value;
  }
}
```

### Control Flow

```typescript
// If/else
if (condition) {
  doSomething();
} else if (otherCondition) {
  doOther();
} else {
  doDefault();
}

// Switch
switch (value) {
  case 1:
    handleOne();
    break;
  case 2:
    handleTwo();
    break;
  default:
    handleDefault();
}

// Loops
for (let i = 0; i < 10; i++) {
  console.log(i);
}

for (const item of items) {
  process(item);
}

while (condition) {
  doWork();
}
```

### Error Handling

```typescript
try {
  riskyOperation();
} catch (error) {
  console.log("Error:", error);
} finally {
  cleanup();
}

throw new Error("Something went wrong");
```

### Arrays

```typescript
const numbers: number[] = [1, 2, 3];
const mixed: Array<number | string> = [1, "two", 3];

// Array methods (JS mode)
const doubled = numbers.map(n => n * 2);
const filtered = numbers.filter(n => n > 1);
const sum = numbers.reduce((a, b) => a + b, 0);
```

### Objects

```typescript
interface Config {
  host: string;
  port: number;
}

const config: Config = {
  host: "localhost",
  port: 8080
};

// Spread operator
const updated: Config = { ...config, port: 9000 };
```

### Template Literals

```typescript
const name = "World";
const greeting = `Hello, ${name}!`;
const multiline = `
  Line 1
  Line 2
`;
```

### Destructuring

```typescript
// Array destructuring
const [first, second, ...rest] = [1, 2, 3, 4, 5];

// Object destructuring
const { name, age } = person;
const { x: posX, y: posY } = point;
```

### Optional Chaining and Nullish Coalescing

```typescript
const name = user?.profile?.name;
const displayName = name ?? "Anonymous";
```

## Module System

Tsonic uses ESM (ECMAScript Modules) with **mandatory `.ts` extensions** for local imports.

### Local Imports

```typescript
// ✅ Correct - with .ts extension
import { User } from "./models/User.ts";
import { formatDate } from "../utils/date.ts";

// ❌ Wrong - missing extension
import { User } from "./models/User";  // ERROR
```

### Named Exports/Imports

```typescript
// utils.ts
export const PI = 3.14159;
export function add(a: number, b: number): number {
  return a + b;
}

// App.ts
import { PI, add } from "./utils.ts";
```

### Re-exports

```typescript
// models/index.ts (barrel file)
export { User } from "./User.ts";
export { Product } from "./Product.ts";
export type { Order } from "./Order.ts";

// App.ts
import { User, Product } from "./models/index.ts";
```

### Namespace Imports

```typescript
import * as utils from "./utils.ts";
console.log(utils.PI);
utils.add(1, 2);
```

### .NET Imports

.NET imports do NOT use `.ts` extension:

```typescript
// ✅ Correct
import { Console } from "@tsonic/dotnet/System";
import { File } from "@tsonic/dotnet/System.IO";

// ❌ Wrong
import { Console } from "@tsonic/dotnet/System.ts";
```

## Entry Point

Every executable needs a `main()` function exported from the entry point:

```typescript
// src/App.ts
export function main(): void {
  console.log("Hello!");
}

// Async main is supported
export async function main(): Promise<void> {
  await doAsyncWork();
}
```

## Unsupported Features

The following TypeScript/JavaScript features are not supported:

| Feature | Reason | Alternative |
|---------|--------|-------------|
| `with` statement | Deprecated, unpredictable | Use explicit property access |
| Dynamic `import()` | Requires runtime loading | Use static imports |
| `import.meta` | Runtime feature | Not available |
| `eval()` | Cannot compile dynamically | Not available |
| `Promise.then/catch` | Callback chains | Use `async/await` |
| Decorators | Experimental | Not supported yet |
| `any` type | Breaks type safety | Use `unknown` or specific types |

### Promise Chaining

```typescript
// ❌ Not supported
promise.then(result => doSomething(result));

// ✅ Use async/await
const result = await promise;
doSomething(result);
```

## Type Annotations

Explicit type annotations are recommended and sometimes required:

```typescript
// Function parameters must be typed
function greet(name: string): void {  // ✅
  console.log(name);
}

function greet(name) {  // ❌ Error: parameter needs type
  console.log(name);
}

// Return types are inferred but can be explicit
function add(a: number, b: number): number {
  return a + b;
}
```

## Naming Conventions

### File to Class Mapping

| File | Generated Class |
|------|-----------------|
| `App.ts` | `App` |
| `UserService.ts` | `UserService` |
| `my-utils.ts` | `my_utils` |

### Directory to Namespace Mapping

| Path | Namespace |
|------|-----------|
| `src/App.ts` | `MyApp.src.App` |
| `src/models/User.ts` | `MyApp.src.models.User` |
