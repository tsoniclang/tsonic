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

Every executable needs a `main()` function exported from the entry point.

### Basic Entry Point

```typescript
export function main(): void {
  console.log("Hello!");
}
```

### Async Entry Point

```typescript
export async function main(): Promise<void> {
  const data = await fetchData();
  console.log(data);
}
```

### Command-Line Arguments

```typescript
export function main(args: string[]): void {
  for (const arg of args) {
    console.log(arg);
  }
}
```

Run with:
```bash
./myapp arg1 arg2 arg3
```

### Exit Codes

Return an exit code to indicate success or failure:

```typescript
import { int } from "@tsonic/types";

export function main(): int {
  if (errorCondition) {
    return 1;  // Error
  }
  return 0;  // Success
}
```

### Library Output

For libraries without an entry point, use `--output-type library`:

```bash
tsonic build src/index.ts --output-type library
```

This produces a `.dll` instead of an executable.

## Generators

Generator functions compile to C# iterators:

```typescript
function* counter(): Generator<number> {
  let i = 0;
  while (i < 5) {
    yield i++;
  }
}

export function main(): void {
  for (const n of counter()) {
    console.log(n);
  }
}
```

### Bidirectional Generators

Generators can receive values via `next(value)`:

```typescript
function* accumulator(start: number): Generator<number, void, number> {
  let total = start;
  while (true) {
    const value = yield total;
    total += value ?? 0;
  }
}

export function main(): void {
  const gen = accumulator(10);
  console.log(gen.next().value);     // 10
  console.log(gen.next(5).value);    // 15
  console.log(gen.next(3).value);    // 18
}
```

### Async Generators

```typescript
async function* fetchItems(): AsyncGenerator<string> {
  for (let i = 0; i < 5; i++) {
    await delay(100);
    yield `Item ${i}`;
  }
}

export async function main(): Promise<void> {
  for await (const item of fetchItems()) {
    console.log(item);
  }
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

## Namespace and Class Mapping

Tsonic maps your directory structure directly to C# namespaces.

### The Mapping Rule

**Directory path = C# namespace (case-preserved)**

```
src/models/User.ts  ->  namespace MyApp.src.models { class User {} }
src/api/v1/handlers.ts  ->  namespace MyApp.src.api.v1 { class handlers {} }
```

### Root Namespace

Set via CLI or config:

```bash
tsonic build src/main.ts --namespace MyApp
```

Or in `tsonic.json`:

```json
{
  "rootNamespace": "MyApp"
}
```

### File to Class Mapping

The file name (without `.ts`) becomes the C# class name:

| File | Generated Class |
|------|-----------------|
| `App.ts` | `class App` |
| `UserService.ts` | `class UserService` |
| `my-utils.ts` | `class my_utils` (hyphens to underscores) |

### Directory to Namespace Mapping

Each directory becomes a namespace segment:

```
MyApp/              (root namespace)
├── models/         -> MyApp.models
│   ├── User.ts     -> MyApp.models.User
│   └── Product.ts  -> MyApp.models.Product
└── services/       -> MyApp.services
    └── api.ts      -> MyApp.services.api
```

### Case Preservation

Directory names keep their exact case:

```
src/Models/User.ts   -> MyApp.src.Models.User  (capital M)
src/models/User.ts   -> MyApp.src.models.User  (lowercase m)
```

Be consistent with casing across your project.

### Static Container Classes

Files with top-level exports become static classes:

```typescript
// math.ts
export const PI = 3.14159;
export function add(a: number, b: number): number {
  return a + b;
}
```

Becomes:

```csharp
namespace MyApp
{
    public static class math
    {
        public static readonly double PI = 3.14159;
        public static double add(double a, double b)
        {
            return a + b;
        }
    }
}
```

### Importing Across Namespaces

TypeScript imports resolve to C# namespace references:

```typescript
// src/services/UserService.ts
import { User } from "../models/User.ts";

export class UserService {
  getUser(): User {
    return new User("John");
  }
}
```

Becomes:

```csharp
namespace MyApp.src.services
{
    public class UserService
    {
        public MyApp.src.models.User getUser()
        {
            return new MyApp.src.models.User("John");
        }
    }
}
```
