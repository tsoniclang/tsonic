# Language Basics

**Goal**: Understand how TypeScript maps to C# in Tsonic

**Time**: ~20 minutes

**Prerequisites**: Completed [Quickstart Guide](01-quickstart.md)

---

## Overview

Tsonic compiles TypeScript to C#, preserving **exact JavaScript semantics**. This means:

- Arrays behave like JavaScript arrays (sparse, dynamic)
- Numbers are always `double` (JavaScript has only one number type)
- Strings are immutable and UTF-16
- `null` and `undefined` are distinct values
- Object property access is dynamic

---

## Type Mappings

### Primitive Types

| TypeScript  | C# Output           | Runtime Type                 | Semantics                          |
| ----------- | ------------------- | ---------------------------- | ---------------------------------- |
| `number`    | `double`            | `double`                     | JavaScript number (always float64) |
| `string`    | `string`            | `string`                     | UTF-16 immutable string            |
| `boolean`   | `bool`              | `bool`                       | true/false                         |
| `null`      | `null`              | `object?`                    | Nullable reference                 |
| `undefined` | `TSUndefined.Value` | `Tsonic.Runtime.TSUndefined` | Singleton value                    |
| `void`      | `void`              | `void`                       | No return value                    |

### Example

```typescript
// TypeScript
const count: number = 42;
const name: string = "Alice";
const active: boolean = true;
const empty: null = null;
const missing: undefined = undefined;
```

```csharp
// Generated C#
double count = 42;
string name = "Alice";
bool active = true;
object? empty = null;
TSUndefined missing = TSUndefined.Value;
```

---

## Arrays

TypeScript arrays compile to `Tsonic.Runtime.Array<T>` which preserves JavaScript semantics:

### Dynamic and Sparse

```typescript
// TypeScript
const arr: number[] = [];
arr[0] = 10;
arr[10] = 20; // Sparse array!
console.log(arr.length); // 11
console.log(arr[5]); // undefined
```

```csharp
// Generated C# (conceptual)
var arr = new Tsonic.Runtime.Array<double>();
arr[0] = 10;
arr[10] = 20;  // Creates sparse array
Console.WriteLine(arr.length);  // 11
Console.WriteLine(arr[5]);      // TSUndefined.Value
```

### Array Methods

All JavaScript array methods are available:

```typescript
const numbers = [1, 2, 3, 4, 5];

// map
const doubled = numbers.map((n) => n * 2);
// [2, 4, 6, 8, 10]

// filter
const evens = numbers.filter((n) => n % 2 === 0);
// [2, 4]

// reduce
const sum = numbers.reduce((acc, n) => acc + n, 0);
// 15

// find
const first = numbers.find((n) => n > 2);
// 3

// every, some
const allPositive = numbers.every((n) => n > 0); // true
const hasNegative = numbers.some((n) => n < 0); // false
```

**Implementation**: These compile to C# extension methods in `Tsonic.Runtime.ArrayExtensions`

---

## Objects and Interfaces

### Object Literals

```typescript
// TypeScript
const user = {
  name: "Alice",
  age: 30,
  active: true,
};
```

```csharp
// Generated C#
var user = new {
  name = "Alice",
  age = 30.0,
  active = true
};
```

### Interfaces

```typescript
// TypeScript
interface User {
  name: string;
  age: number;
  email?: string; // Optional property
}

const alice: User = {
  name: "Alice",
  age: 30,
};
```

```csharp
// Generated C#
public interface User
{
  string name { get; }
  double age { get; }
  string? email { get; }  // Nullable for optional
}

var alice = new UserImpl {
  name = "Alice",
  age = 30.0,
  email = null
};
```

---

## Functions

### Function Declarations

```typescript
// TypeScript
function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

```csharp
// Generated C#
public static string greet(string name)
{
  return $"Hello, {name}!";
}
```

### Arrow Functions

```typescript
// TypeScript
const add = (a: number, b: number): number => a + b;

const greet = (name: string): string => {
  const greeting = `Hello, ${name}!`;
  return greeting;
};
```

```csharp
// Generated C#
var add = (double a, double b) => a + b;

var greet = (string name) => {
  var greeting = $"Hello, {name}!";
  return greeting;
};
```

### Optional Parameters

```typescript
// TypeScript
function greet(name: string, greeting?: string): string {
  return `${greeting ?? "Hello"}, ${name}!`;
}
```

```csharp
// Generated C#
public static string greet(string name, string? greeting = null)
{
  return $"{greeting ?? "Hello"}, {name}!";
}
```

### Rest Parameters

```typescript
// TypeScript
function sum(...numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}
```

```csharp
// Generated C#
public static double sum(params double[] numbers)
{
  return numbers.Aggregate(0.0, (acc, n) => acc + n);
}
```

---

## Classes

### Basic Class

```typescript
// TypeScript
class User {
  name: string;
  age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  greet(): string {
    return `Hello, I'm ${this.name}`;
  }
}
```

```csharp
// Generated C#
public class User
{
  public string name;
  public double age;

  public User(string name, double age)
  {
    this.name = name;
    this.age = age;
  }

  public string greet()
  {
    return $"Hello, I'm {this.name}";
  }
}
```

### Inheritance

```typescript
// TypeScript
class Animal {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  speak(): void {
    console.log(`${this.name} makes a sound`);
  }
}

class Dog extends Animal {
  speak(): void {
    console.log(`${this.name} barks`);
  }
}
```

```csharp
// Generated C#
public class Animal
{
  public string name;

  public Animal(string name)
  {
    this.name = name;
  }

  public virtual void speak()
  {
    Console.WriteLine($"{this.name} makes a sound");
  }
}

public class Dog : Animal
{
  public override void speak()
  {
    Console.WriteLine($"{this.name} barks");
  }
}
```

---

## Generics

### Generic Functions

```typescript
// TypeScript
function identity<T>(value: T): T {
  return value;
}

const num = identity<number>(42);
const str = identity<string>("hello");
```

```csharp
// Generated C# (monomorphized)
public static double identity_number(double value)
{
  return value;
}

public static string identity_string(string value)
{
  return value;
}

var num = identity_number(42.0);
var str = identity_string("hello");
```

**Note**: Tsonic uses **monomorphization** - each generic instantiation becomes a separate concrete function.

### Generic Classes

```typescript
// TypeScript
class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  get(): T {
    return this.value;
  }
}
```

```csharp
// Generated C# (monomorphized for each usage)
public class Box_number
{
  public double value;

  public Box_number(double value)
  {
    this.value = value;
  }

  public double get()
  {
    return this.value;
  }
}
```

---

## Module System

### Exporting

```typescript
// math.ts
export function add(a: number, b: number): number {
  return a + b;
}

export const PI = 3.14159;

export class Calculator {
  // ...
}
```

### Importing

```typescript
// main.ts
import { add, PI, Calculator } from "./math.ts"; // ← .ts extension required!

export function main(): void {
  const result = add(2, 3);
  console.log(result);
}
```

**Critical Rules**:

1. **Local imports MUST have `.ts` extension**
2. **.NET imports must NOT have `.ts` extension**
3. **ESM-only** - no CommonJS (`require`)

### Default Exports

```typescript
// user.ts
export default class User {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

// main.ts
import User from "./user.ts";
```

---

## Control Flow

### If/Else

```typescript
// TypeScript
if (age >= 18) {
  console.log("Adult");
} else if (age >= 13) {
  console.log("Teen");
} else {
  console.log("Child");
}
```

```csharp
// Generated C#
if (age >= 18)
{
  Console.WriteLine("Adult");
}
else if (age >= 13)
{
  Console.WriteLine("Teen");
}
else
{
  Console.WriteLine("Child");
}
```

### For Loops

```typescript
// TypeScript
for (let i = 0; i < 10; i++) {
  console.log(i);
}

// for-of
for (const item of items) {
  console.log(item);
}

// for-in
for (const key in obj) {
  console.log(key, obj[key]);
}
```

```csharp
// Generated C#
for (var i = 0.0; i < 10; i++)
{
  Console.WriteLine(i);
}

// for-of
foreach (var item in items)
{
  Console.WriteLine(item);
}

// for-in
foreach (var key in obj.Keys)
{
  Console.WriteLine(key, obj[key]);
}
```

### While Loops

```typescript
// TypeScript
while (count < 10) {
  count++;
}

do {
  count++;
} while (count < 10);
```

```csharp
// Generated C#
while (count < 10)
{
  count++;
}

do
{
  count++;
} while (count < 10);
```

---

## Operators

### Arithmetic

| TypeScript | C#         | Semantics                                   |
| ---------- | ---------- | ------------------------------------------- |
| `+`        | `+`        | Addition (number) or concatenation (string) |
| `-`        | `-`        | Subtraction                                 |
| `*`        | `*`        | Multiplication                              |
| `/`        | `/`        | Division (always float)                     |
| `%`        | `%`        | Remainder                                   |
| `**`       | `Math.Pow` | Exponentiation                              |

### Comparison

| TypeScript           | C#   | Semantics          |
| -------------------- | ---- | ------------------ |
| `===`                | `==` | Strict equality    |
| `!==`                | `!=` | Strict inequality  |
| `<`, `>`, `<=`, `>=` | Same | Numeric comparison |

**Note**: `==` and `!=` (loose equality) are NOT supported - use strict equality `===` and `!==`.

### Logical

| TypeScript | C#   | Semantics          |
| ---------- | ---- | ------------------ | --- | --- | --- | ---------- |
| `&&`       | `&&` | Logical AND        |
| `          |      | `                  | `   |     | `   | Logical OR |
| `!`        | `!`  | Logical NOT        |
| `??`       | `??` | Nullish coalescing |

### Nullish Coalescing

```typescript
// TypeScript
const name = userName ?? "Guest";
```

```csharp
// Generated C#
var name = userName ?? "Guest";
```

---

## String Templates

```typescript
// TypeScript
const name = "Alice";
const age = 30;
const message = `Hello, ${name}! You are ${age} years old.`;
```

```csharp
// Generated C#
var name = "Alice";
var age = 30.0;
var message = $"Hello, {name}! You are {age} years old.";
```

---

## Destructuring

### Array Destructuring

```typescript
// TypeScript
const [first, second, ...rest] = [1, 2, 3, 4, 5];
```

```csharp
// Generated C#
var first = arr[0];
var second = arr[1];
var rest = arr.Slice(2);
```

### Object Destructuring

```typescript
// TypeScript
const { name, age } = user;
const { name: userName, age: userAge } = user;
```

```csharp
// Generated C#
var name = user.name;
var age = user.age;
var userName = user.name;
var userAge = user.age;
```

---

## Spread Operator

### Array Spread

```typescript
// TypeScript
const arr1 = [1, 2, 3];
const arr2 = [4, 5, 6];
const combined = [...arr1, ...arr2];
```

```csharp
// Generated C#
var arr1 = new[] { 1.0, 2.0, 3.0 }.ToTsonicArray();
var arr2 = new[] { 4.0, 5.0, 6.0 }.ToTsonicArray();
var combined = arr1.Concat(arr2).ToTsonicArray();
```

### Object Spread

```typescript
// TypeScript
const user = { name: "Alice", age: 30 };
const updated = { ...user, age: 31 };
```

```csharp
// Generated C#
var user = new { name = "Alice", age = 30.0 };
var updated = new { name = user.name, age = 31.0 };
```

---

## What's Not Supported

Some TypeScript features are not yet supported:

- **Decorators** - No equivalent in C#
- **Symbols** - Complex runtime behavior
- **Proxies** - Dynamic interception not supported
- **WeakMap/WeakSet** - GC integration required
- **eval** and **Function constructor** - Security/performance

See [Limitations](../reference/language/limitations.md) for complete list.

---

## Key Takeaways

1. **Numbers are always `double`** - JavaScript has only one number type
2. **Arrays preserve JS semantics** - Sparse, dynamic, with all methods
3. **Generics use monomorphization** - Each usage becomes concrete type
4. **Modules require `.ts` extensions** - For local imports only
5. **Exact JavaScript behavior** - Via `Tsonic.Runtime` library

---

## Next Steps

- **[Using .NET Libraries →](03-using-dotnet.md)** - Integrate with .NET ecosystem
- **[Language Reference](../reference/language/INDEX.md)** - Complete language documentation

---

**Previous**: [← Quickstart](01-quickstart.md) | **Next**: [Using .NET Libraries →](03-using-dotnet.md)
