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
  Completed,
}

export enum Color {
  Red = "red",
  Green = "green",
  Blue = "blue",
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
import { Console } from "@tsonic/dotnet/System.js";

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
  Console.WriteLine(i);
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
import { Console } from "@tsonic/dotnet/System.js";

try {
  riskyOperation();
} catch (error) {
  Console.WriteLine("Error");
} finally {
  cleanup();
}

throw new Error("Something went wrong");
```

### Arrays

```typescript
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";

const numbers: number[] = [1, 2, 3];
const mixed: Array<number | string> = [1, "two", 3];

// Arrays emit as native C# arrays (T[])
// Use LINQ for functional-style operations
const doubled = Enumerable.Select(numbers, (n: number): number => n * 2);
const filtered = Enumerable.Where(numbers, (n: number): boolean => n > 1);
```

### Tuples

Fixed-length arrays with specific element types:

```typescript
const point: [number, number] = [10, 20];
const record: [string, number, boolean] = ["name", 42, true];

// Access elements
const x = point[0]; // 10
const y = point[1]; // 20
```

Generates `ValueTuple<T1, T2, ...>` in C#.

### Dictionary and HashSet

Tsonic does not include JavaScript `Map`/`Set` in the default globals (see `@tsonic/dotnet` + `System.Collections.Generic` instead).

```typescript
import { Dictionary, HashSet } from "@tsonic/dotnet/System.Collections.Generic.js";

// Dictionary<TKey, TValue> - key-value pairs
const userMap = new Dictionary<string, User>();
userMap.Add("alice", alice);
const hasAlice = userMap.ContainsKey("alice");

// HashSet<T> - unique values
const ids = new HashSet<number>();
ids.Add(1);
ids.Add(2);
const hasOne = ids.Contains(1); // true
```

### Objects

```typescript
interface Config {
  host: string;
  port: number;
}

const config: Config = {
  host: "localhost",
  port: 8080,
};

// Spread operator
const updated: Config = { ...config, port: 9000 };
```

#### Anonymous Object Literals

Simple object literals auto-synthesize types without explicit annotation:

```typescript
// Auto-synthesized - no error
const point = { x: 1, y: 2 };
const handler = { id: 1, process: (x: number) => x * 2 };

// Method shorthand requires explicit type
interface Handler {
  process(): void;
}
const h: Handler = { process() {} }; // OK with type annotation
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

Tsonic supports full JavaScript destructuring patterns with array and object destructuring.

#### Array Destructuring

```typescript
// Basic array destructuring
const [first, second] = [1, 2];

// Rest patterns
const [head, ...tail] = [1, 2, 3, 4, 5];
// head = 1, tail = [2, 3, 4, 5]

// Holes (skip elements)
const [a, , c] = [1, 2, 3];
// a = 1, c = 3 (second element skipped)

// Default values
const [x = 10, y = 20] = [5];
// x = 5, y = 20 (default used for missing element)
```

#### Object Destructuring

```typescript
// Basic object destructuring
const { name, age } = person;

// Property renaming
const { firstName: name, lastName: surname } = user;

// Rest properties
const { id, ...rest } = { id: 1, name: "Alice", age: 30 };
// id = 1, rest = { name: "Alice", age: 30 }

// Default values
const { host = "localhost", port = 8080 } = config;
```

#### Nested Patterns

```typescript
// Nested object destructuring
const {
  address: { city, zip },
} = user;

// Nested array destructuring
const [[a, b], [c, d]] = [
  [1, 2],
  [3, 4],
];

// Mixed nesting
const {
  items: [first, second],
} = order;
```

#### For-of Destructuring

```typescript
import { Console } from "@tsonic/dotnet/System.js";

// Destructure in for-of loops
const entries = [
  ["a", 1],
  ["b", 2],
];
for (const [key, value] of entries) {
  Console.WriteLine(`${key}: ${value}`);
}

// Object destructuring in for-of
const users = [{ name: "Alice" }, { name: "Bob" }];
for (const { name } of users) {
  Console.WriteLine(name);
}
```

#### Parameter Destructuring

```typescript
import { Console } from "@tsonic/dotnet/System.js";

// Function parameter destructuring
function greet({ name, age }: Person): void {
  Console.WriteLine(`Hello ${name}, you are ${age}`);
}

// Array parameter destructuring
function swap([a, b]: [number, number]): [number, number] {
  return [b, a];
}

// With defaults
function connect({ host = "localhost", port = 80 }: Config): void {
  // ...
}
```

#### Assignment Destructuring

```typescript
let a: number, b: number;

// Assign via destructuring (parentheses required)
[a, b] = [1, 2];
({ x: a, y: b } = point);
```

### Optional Chaining and Nullish Coalescing

```typescript
const name = user?.profile?.name;
const displayName = name ?? "Anonymous";
```

## Module System

Tsonic uses ESM (ECMAScript Modules). Local imports must include a file extension (`.js` is recommended; `.ts` is also accepted).

### Local Imports

```typescript
// ✅ Correct - with extension
import { User } from "./models/User.js";
import { formatDate } from "../utils/date.js";

// ❌ Wrong - missing extension
import { User } from "./models/User"; // ERROR
```

### Named Exports/Imports

```typescript
// utils.ts
export const PI = 3.14159;
export function add(a: number, b: number): number {
  return a + b;
}

// App.ts
import { PI, add } from "./utils.js";
```

### Re-exports

```typescript
// models/index.ts (barrel file)
export { User } from "./User.js";
export { Product } from "./Product.js";
export type { Order } from "./Order.js";

// App.ts
import { User, Product } from "./models/index.js";
```

### Namespace Imports

```typescript
import * as utils from "./utils.js";
import { Console } from "@tsonic/dotnet/System.js";
Console.WriteLine(utils.PI);
utils.add(1, 2);
```

### .NET Imports

.NET imports are ESM too; use `.js` module specifiers:

```typescript
// ✅ Correct
import { Console } from "@tsonic/dotnet/System.js";
import { File } from "@tsonic/dotnet/System.IO.js";

// ❌ Wrong
import { Console } from "@tsonic/dotnet/System";
import { Console } from "@tsonic/dotnet/System.ts";
```

## Entry Point

Every executable needs a `main()` function exported from the entry point.

### Basic Entry Point

```typescript
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  Console.WriteLine("Hello!");
}
```

### Async Entry Point

```typescript
import { Console } from "@tsonic/dotnet/System.js";

export async function main(): Promise<void> {
  const data = await fetchData();
  Console.WriteLine(data);
}
```

### Command-Line Arguments

```typescript
import { Console } from "@tsonic/dotnet/System.js";

export function main(args: string[]): void {
  for (const arg of args) {
    Console.WriteLine(arg);
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
import { int } from "@tsonic/core/types.js";

export function main(): int {
  if (errorCondition) {
    return 1; // Error
  }
  return 0; // Success
}
```

### Library Output

For libraries, set `output.type` to `"library"` in `tsonic.json` (or a separate config), then run `tsonic build`.

```json
{
  "rootNamespace": "MyLib",
  "output": { "type": "library" }
}
```

## Generators

Generator functions compile to C# iterators:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function* counter(): Generator<number> {
  let i = 0;
  while (i < 5) {
    yield i++;
  }
}

export function main(): void {
  for (const n of counter()) {
    Console.WriteLine(n);
  }
}
```

> **See also:** [Generators Guide](generators.md) for comprehensive coverage including bidirectional generators, async generators, and return values.

### Bidirectional Generators

Generators can receive values via `next(value)`:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function* accumulator(start: number): Generator<number, void, number> {
  let total = start;
  while (true) {
    const value = yield total;
    total += value ?? 0;
  }
}

export function main(): void {
  const gen = accumulator(10);
  Console.WriteLine(gen.next().value); // 10
  Console.WriteLine(gen.next(5).value); // 15
  Console.WriteLine(gen.next(3).value); // 18
}
```

### Async Generators

```typescript
import { Console } from "@tsonic/dotnet/System.js";

async function* fetchItems(): AsyncGenerator<string> {
  for (let i = 0; i < 5; i++) {
    await delay(100);
    yield `Item ${i}`;
  }
}

export async function main(): Promise<void> {
  for await (const item of fetchItems()) {
    Console.WriteLine(item);
  }
}
```

### Generator Wrapper Methods

Bidirectional generators provide standard JavaScript generator methods:

- `next(value?)` - Advances the generator and optionally passes a value
- `return(value)` - Terminates the generator and sets the return value
- `throw(error)` - Terminates the generator and throws an exception

**Limitation:** Unlike JavaScript, the `.throw()` method does NOT inject the exception at the suspended yield point. C# iterators don't support resumption with exceptions. The exception is thrown externally after disposing the enumerator. Code like this will NOT behave the same as JavaScript:

```typescript
// This JavaScript pattern does NOT work the same in Tsonic:
function* withTryCatch(): Generator<number> {
  try {
    yield 1;
    yield 2; // JS: gen.throw() resumes here with exception
  } catch (e) {
    yield -1; // JS: caught exception, yields -1
  }
}

const gen = withTryCatch();
gen.next(); // { value: 1, done: false }
gen.throw(Error()); // JS: { value: -1, done: false }
// Tsonic: throws immediately
```

## Type Narrowing

Tsonic supports type narrowing through type guards and predicates.

### Type Predicates

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function process(value: string | number): void {
  if (isString(value)) {
    Console.WriteLine(value.toUpperCase()); // value is string here
  } else {
    Console.WriteLine(value * 2); // value is number here
  }
}
```

### typeof Guards

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function handle(value: string | number | boolean): void {
  if (typeof value === "string") {
    Console.WriteLine(value.length);
  } else if (typeof value === "number") {
    Console.WriteLine(value.toFixed(2));
  } else {
    Console.WriteLine(value ? "yes" : "no");
  }
}
```

### Negated Guards

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function process(value: string | null): void {
  if (value === null) {
    return;
  }
  // value is string here (null eliminated)
  Console.WriteLine(value.toUpperCase());
}

function handleOptional(value?: string): void {
  if (!value) {
    return;
  }
  // value is string here
  Console.WriteLine(value.length);
}
```

### Compound Guards

```typescript
interface Cat {
  meow(): void;
}
interface Dog {
  bark(): void;
}

function isCat(pet: Cat | Dog): pet is Cat {
  return "meow" in pet;
}

function isDog(pet: Cat | Dog): pet is Dog {
  return "bark" in pet;
}

function handle(pet: Cat | Dog): void {
  if (isCat(pet) && pet.meow) {
    pet.meow();
  }
}
```

## Unsupported Features

The following TypeScript/JavaScript features are not supported:

| Feature              | Reason                     | Alternative                     |
| -------------------- | -------------------------- | ------------------------------- |
| `with` statement     | Deprecated, unpredictable  | Use explicit property access    |
| Dynamic `import()`   | Requires runtime loading   | Use static imports              |
| `import.meta`        | Runtime feature            | Not available                   |
| `eval()`             | Cannot compile dynamically | Not available                   |
| `Promise.then/catch` | Callback chains            | Use `async/await`               |
| Decorators           | Experimental               | Not supported yet               |
| `any` type           | Breaks type safety         | Use `unknown` or specific types |

### Promise Chaining

```typescript
declare const promise: Promise<number>;
declare function doSomething(result: number): void;

export async function main(): Promise<void> {
  // ❌ Not supported
  // promise.then((result) => doSomething(result));

  // ✅ Use async/await
  const result = await promise;
  doSomething(result);
}
```

## Type Annotations

Explicit type annotations are recommended and sometimes required:

```typescript
// Function parameters must be typed
import { Console } from "@tsonic/dotnet/System.js";

function greetOk(name: string): void {
  // ✅
  Console.WriteLine(name);
}

function greetBad(name) {
  // ❌ Error: parameter needs type
  Console.WriteLine(name);
}

// Return types are inferred but can be explicit
function add(a: number, b: number): number {
  return a + b;
}
```

## Namespace and Class Mapping

Tsonic maps your directory structure directly to C# namespaces.

### The Mapping Rule

**Directory path = C# namespace (hyphens removed; case preserved)**

```
src/Models/User.ts         ->  namespace MyApp.Models { class User {} }
src/Api/V1/Handlers.ts     ->  namespace MyApp.Api.V1 { class Handlers {} }
src/todo-list.ts           ->  class todolist
```

### Root Namespace

Set via CLI or config:

```bash
tsonic build src/App.ts --namespace MyApp
```

Or in `packages/<project>/tsonic.json`:

```json
{
  "rootNamespace": "MyApp"
}
```

### File to Class Mapping

The file name (without `.ts`) becomes the C# class name:

| File             | Generated Class                           |
| ---------------- | ----------------------------------------- |
| `App.ts`         | `class App`                               |
| `UserService.ts` | `class UserService`                       |
| `my-utils.ts`    | `class myutils`                           |
| `todo-list.ts`   | `class todolist`                          |

### Directory to Namespace Mapping

Each directory becomes a namespace segment:

```
MyApp/              (root namespace)
├── Models/         -> MyApp.Models
│   ├── User.ts     -> MyApp.Models.User
│   └── Product.ts  -> MyApp.Models.Product
└── Services/       -> MyApp.Services
    └── Api.ts      -> MyApp.Services.Api
```

### Case Preservation (No Renaming)

Tsonic does not apply casing transforms. If you want CLR-style casing, name your folders/files that way.

```
src/Models/User.ts   -> MyApp.Models.User
src/models/User.ts   -> MyApp.models.User
```

### Static Container Classes

Files with top-level exports become static classes:

```typescript
// Math.ts
export const pi = 3.14159;
export function add(a: number, b: number): number {
  return a + b;
}
```

Becomes:

```csharp
namespace MyApp
{
    public static class Math
    {
        public static readonly double pi = 3.14159;
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
// src/Services/UserService.ts
import { User } from "../Models/User.js";

export class UserService {
  getUser(): User {
    return new User("John");
  }
}
```

Becomes:

```csharp
namespace MyApp.Services
{
    public class UserService
    {
        public MyApp.Models.User getUser()
        {
            return new MyApp.Models.User("John");
        }
    }
}
```
