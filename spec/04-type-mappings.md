# Type Mappings

## Overview

Tsonic uses **native .NET types** directly. TypeScript types map to C# types with no wrapper classes. JavaScript semantics are provided through `Tsonic.Runtime` static helper functions.

## Primitive Types

| TypeScript  | C#               | Notes                                                             |
| ----------- | ---------------- | ----------------------------------------------------------------- |
| `number`    | `double`         | Default numeric type                                              |
| `string`    | `string`         | Native C# string (immutable)                                      |
| `boolean`   | `bool`           | Direct mapping                                                    |
| `void`      | `void`           | Direct mapping                                                    |
| `undefined` | `null`           | Maps to C# null (reference types only - see Optional Types below) |
| `null`      | `null`           | C# null                                                           |
| `any`       | `dynamic`        | C# dynamic type - enables runtime type resolution                 |
| `unknown`   | `object?`        | Nullable object, use with typeof guards                           |
| `never`     | ❌ NOT SUPPORTED | Error TSN3003 in MVP                                              |

## Optional Types and Nullable Value Types

TypeScript uses `undefined` for optional values, but C# distinguishes between reference types (nullable by default) and value types (require `?` for nullability).

### Optional Parameters and Properties

| TypeScript Type        | C# Type    | Notes                             |
| ---------------------- | ---------- | --------------------------------- |
| `string \| undefined`  | `string?`  | Nullable reference type (C# 8.0+) |
| `number \| undefined`  | `double?`  | Nullable value type               |
| `boolean \| undefined` | `bool?`    | Nullable value type               |
| `int \| undefined`     | `int?`     | Nullable value type               |
| `decimal \| undefined` | `decimal?` | Nullable value type               |

**Examples:**

```typescript
// Optional parameters
function greet(name?: string): void {
  console.log(name ?? "World");
}

// Optional properties
interface User {
  name: string;
  age?: number;
}

// Explicit union with undefined
function process(value: number | undefined): void {
  if (value !== undefined) {
    console.log(value * 2);
  }
}
```

**Generated C#:**

```csharp
public static void greet(string? name = null)
{
    Tsonic.Runtime.console.log(name ?? "World");
}

public class User
{
    public string name { get; set; }
    public double? age { get; set; }
}

public static void process(double? value)
{
    if (value != null)
    {
        Tsonic.Runtime.console.log(value * 2);
    }
}
```

## C# Numeric Types

TypeScript can use explicit C# numeric types for precision and interop:

| TypeScript Type | C# Type   | Range / Notes                   |
| --------------- | --------- | ------------------------------- |
| `int`           | `int`     | -2,147,483,648 to 2,147,483,647 |
| `uint`          | `uint`    | 0 to 4,294,967,295              |
| `byte`          | `byte`    | 0 to 255                        |
| `sbyte`         | `sbyte`   | -128 to 127                     |
| `short`         | `short`   | -32,768 to 32,767               |
| `ushort`        | `ushort`  | 0 to 65,535                     |
| `long`          | `long`    | ±9 quintillion                  |
| `ulong`         | `ulong`   | 0 to 18 quintillion             |
| `float`         | `float`   | Single precision                |
| `double`        | `double`  | Double precision (default)      |
| `decimal`       | `decimal` | High precision for money        |

**Example:**

```typescript
const count = 42 as int;
const price = 19.99 as decimal;
const percentage = 0.15 as float;
```

**Note:** Due to type branding, you must use `as` type assertions. See [.NET Type Declarations](./14-dotnet-declarations.md) for details.

## Collection Types

### TypeScript Arrays → Tsonic.Runtime.Array<T>

TypeScript arrays map to **`Tsonic.Runtime.Array<T>`**, a custom class that implements exact JavaScript array semantics:

| TypeScript | C#                        | Notes                |
| ---------- | ------------------------- | -------------------- |
| `T[]`      | `Tsonic.Runtime.Array<T>` | JavaScript semantics |
| `Array<T>` | `Tsonic.Runtime.Array<T>` | Same as T[]          |

**Why not native List<T>?** JavaScript arrays support features like **sparse arrays** (arrays with holes) that .NET `List<T>` cannot represent.

**Example:**

```typescript
const nums: number[] = [1, 2, 3];
nums.push(4);
console.log(nums.length); // 4

// Sparse array
const sparse: number[] = [];
sparse[10] = 42;
console.log(sparse.length); // 11
```

```csharp
var nums = new Tsonic.Runtime.Array<double>(1, 2, 3);
nums.push(4);
Tsonic.Runtime.console.log(nums.length); // 4

// Sparse array support
var sparse = new Tsonic.Runtime.Array<double>();
sparse[10] = 42;
Tsonic.Runtime.console.log(sparse.length); // 11
```

### C# Arrays → ReadonlyArray<T>

C# fixed-size arrays are exposed as `ReadonlyArray<T>` in TypeScript to prevent confusion with Tsonic arrays:

```typescript
import { File } from "System.IO";

// C# T[] becomes ReadonlyArray<T>
const lines: ReadonlyArray<string> = File.ReadAllLines("file.txt");
lines.push("test"); // ❌ TypeScript error: push doesn't exist (not a Tsonic array)
lines[0]; // ✅ OK: can read
```

**To make mutable, use C# types:**

```typescript
import { List } from "System.Collections.Generic";

const lines = File.ReadAllLines("file.txt"); // ReadonlyArray<string> (C# T[])
const mutable = new List<string>(lines); // C# List<T>
mutable.Add("test"); // ✅ OK: C# method on C# type
```

### Other Built-In Types

| TypeScript   | C#                     | Notes                              |
| ------------ | ---------------------- | ---------------------------------- |
| `Promise<T>` | `Task<T>`              | Native .NET async                  |
| `Error`      | `Exception`            | Native .NET exceptions             |
| `Date`       | ❌ NOT SUPPORTED (MVP) | Use System.DateTime                |
| `RegExp`     | ❌ NOT SUPPORTED (MVP) | Use System.Text.RegularExpressions |
| `Map<K,V>`   | ❌ NOT SUPPORTED (MVP) | Use Dictionary<K,V>                |
| `Set<T>`     | ❌ NOT SUPPORTED (MVP) | Use HashSet<T>                     |

## String Type

TypeScript `string` maps to **native C# `string`**. Unlike arrays, strings use the native C# type because C# strings already have the immutability and behavior we need. String method calls are rewritten to static helpers to provide JavaScript semantics:

```typescript
const name = "John Doe";
const upper = name.toUpperCase();
const parts = name.split(" ");
```

```csharp
string name = "John Doe";
string upper = Tsonic.Runtime.String.toUpperCase(name);
Tsonic.Runtime.Array<string> parts = Tsonic.Runtime.String.split(name, " ");
```

**All string operations use `Tsonic.Runtime.String` static helpers:**

- `str.toUpperCase()` → `Tsonic.Runtime.String.toUpperCase(str)`
- `str.substring(0, 5)` → `Tsonic.Runtime.String.substring(str, 0, 5)`
- `str.split(" ")` → `Tsonic.Runtime.String.split(str, " ")` (returns Tsonic.Runtime.Array)

See [Runtime Specification](./05-runtime.md) for complete list of string methods.

## Generics

TypeScript generic parameters map directly to C# generic parameters whenever possible. See `spec/15-generics.md` for full translation rules (constraints, call-site rewriting, structural adapters, and specialisation).


## Interfaces and Type Aliases

Interfaces and structural type aliases are emitted as C# classes/interfaces with property mappings, optional member handling, and adapters for structural inheritance. See `spec/16-types-and-interfaces.md` for the full strategy (including generics).

## Async Types

| TypeScript       | C#                  |
| ---------------- | ------------------- |
| `Promise<T>`     | `Task<T>`           |
| `Promise<void>`  | `Task`              |
| `async function` | `async Task` method |
| `await expr`     | `await expr`        |

### Example

```typescript
// TypeScript
async function fetchData(): Promise<string> {
  const result = await getData();
  return result;
}
```

```csharp
// C#
public static async Task<string> fetchData()
{
    var result = await getData();
    return result;
}
```

## Union Types

❌ **NOT SUPPORTED in MVP** - Error TSN3004

Union types will be added in a later phase. For now, use `unknown` with type guards:

```typescript
// ❌ NOT SUPPORTED
type StringOrNumber = string | number;

// ✅ WORKAROUND: Use unknown with typeof
function process(value: unknown): void {
  if (typeof value === "string") {
    console.log(Tsonic.Runtime.String.toLowerCase(value as string));
  } else if (typeof value === "number") {
    console.log((value as number) * 2);
  }
}
```

## Object Types

### Interfaces → C# Classes

```typescript
// TypeScript
interface User {
  name: string;
  age: number;
}
```

```csharp
// C#
public class User
{
    public string name { get; set; }
    public double age { get; set; }
}
```

### Anonymous Objects → Anonymous Types

```typescript
// TypeScript
const obj = { name: "John", age: 30 };
```

```csharp
// C#
var obj = new { name = "John", age = 30.0 };
```

## Generic Types

Generics are preserved with constraints simplified:

```typescript
// TypeScript
function identity<T>(value: T): T {
  return value;
}

class Box<T> {
  constructor(public value: T) {}
}
```

```csharp
// C#
public static T identity<T>(T value)
{
    return value;
}

public class Box<T>
{
    public T value { get; set; }
    public Box(T value) { this.value = value; }
}
```

## Tuple Types

TypeScript tuples map to C# ValueTuples:

```typescript
// TypeScript
type Point = [number, number];
const point: Point = [10, 20];
```

```csharp
// C#
(double, double) point = (10, 20);
```

Named tuples:

```typescript
type Result = [success: boolean, value: string];
```

```csharp
(bool success, string value)
```

## Special TypeScript Types

### Literal Types

```typescript
type Direction = "north" | "south" | "east" | "west";
```

**NOT SUPPORTED in MVP** - ERROR TSN2001

### Conditional Types

```typescript
type IsString<T> = T extends string ? true : false;
```

**NOT SUPPORTED** - ERROR TSN2002

### Mapped Types

```typescript
type Readonly<T> = { readonly [K in keyof T]: T[K] };
```

**NOT SUPPORTED** - ERROR TSN2003

## Type Assertions

```typescript
// TypeScript
const value = someValue as string;
```

```csharp
// C#
var value = (string)someValue;
```

## Type Guards

### typeof

The `typeof` operator is implemented as `Tsonic.Runtime.Operators.typeof()`:

```typescript
function check(value: unknown): string {
  if (typeof value === "string") {
    return "It's a string";
  }
  if (typeof value === "number") {
    return "It's a number";
  }
  return "Unknown type";
}
```

```csharp
public static string check(object? value)
{
    if (Tsonic.Runtime.Operators.typeof(value) == "string")
    {
        return "It's a string";
    }
    if (Tsonic.Runtime.Operators.typeof(value) == "number")
    {
        return "It's a number";
    }
    return "Unknown type";
}
```

**After type guard, cast is required:**

```typescript
if (typeof x === "string") {
  return x.toUpperCase(); // x is narrowed to string
}
```

```csharp
if (Tsonic.Runtime.Operators.typeof(x) == "string")
{
    return Tsonic.Runtime.String.toUpperCase((string)x); // Cast required
}
```

### instanceof

```typescript
if (value instanceof User) {
  console.log(value.name);
}
```

```csharp
if (value is User)
{
    Tsonic.Runtime.console.log(((User)value).name);
}
```

## Enums

```typescript
// TypeScript
enum Color {
  Red = 0,
  Green = 1,
  Blue = 2,
}
```

```csharp
// C#
public enum Color
{
    Red = 0,
    Green = 1,
    Blue = 2
}
```

String enums:

```typescript
enum Status {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
}
```

**NOT SUPPORTED in MVP** - ERROR TSN2004

## Type Inference

Use `var` when TypeScript infers types:

```typescript
const x = 5; // number inferred
const name = "John"; // string inferred
const arr = [1, 2, 3]; // number[] inferred
```

```csharp
var x = 5.0; // double
var name = "John"; // string
var arr = new Tsonic.Runtime.Array<double>(1, 2, 3);
```

## Special Cases

### JSON.parse and Dynamic Types

`JSON.parse()` returns `any` in TypeScript, which maps to C# `dynamic`. You can use it without type annotations, or provide explicit types for better type safety:

```typescript
type User = { id: number; name: string };

// ✅ OK: Returns dynamic (any)
const data = JSON.parse(jsonString);
console.log(data.someProp); // dynamic access

// ✅ BETTER: Explicit type for compile-time safety
const user: User = JSON.parse(jsonString);
console.log(user.name); // type-safe

// ✅ ALSO OK: Type assertion
const user = JSON.parse(jsonString) as User;
```

```csharp
// Without type annotation
dynamic data = Tsonic.Runtime.JSON.parse<dynamic>(jsonString);
Console.WriteLine(data.someProp); // runtime resolution

// With type annotation
User user = Tsonic.Runtime.JSON.parse<User>(jsonString);
Console.WriteLine(user.name); // compile-time type safety
```

### Boundary Conversions

**Within Tsonic code** - Use Tsonic.Runtime.Array:

```typescript
function addItem(items: string[], item: string): void {
  items.push(item);
}
```

```csharp
public static void addItem(Tsonic.Runtime.Array<string> items, string item)
{
    items.push(item); // Instance method on Tsonic.Runtime.Array
}
```

**Calling .NET libraries** - C# types stay C# types, use C# methods:

```typescript
import { File } from "System.IO";
import { List } from "System.Collections.Generic";

// ReadonlyArray<string> - this is a C# T[], NOT a Tsonic array
const lines = File.ReadAllLines("file.txt");
lines.push("test"); // ❌ TypeScript error: push doesn't exist on ReadonlyArray

// Use C# types and C# methods:
const mutable = new List<string>(lines); // C# List<T>
mutable.Add("new line"); // ✅ OK: C# method

// C# List to C# array:
File.WriteAllLines("file.txt", mutable.ToArray()); // C# method
```

**Generated C#:**

```csharp
using System.IO;
using System.Collections.Generic;

// C# method returns C# array
string[] lines = File.ReadAllLines("file.txt");

// C# List with C# methods
var mutable = new List<string>(lines);
mutable.Add("new line");

// C# to C# conversion
File.WriteAllLines("file.txt", mutable.ToArray());
```

## Unsupported Types (MVP)

These generate errors:

- `never` - ERROR TSN3003
- Union types (`A | B`) - ERROR TSN3004
- `symbol` - ERROR TSN2005
- `bigint` - ERROR TSN2006
- Intersection types (`A & B`) - ERROR TSN2007
- Conditional types - ERROR TSN2002
- Mapped types - ERROR TSN2003
- Template literal types - ERROR TSN2008
- Literal types (`"north" | "south"`) - ERROR TSN2001

**Note**: `any` is supported (maps to C# `dynamic`), but use with caution as it bypasses compile-time type checking.
