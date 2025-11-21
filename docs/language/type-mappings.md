# Type Mappings

How TypeScript types map to C# types in Tsonic.

## Quick Reference

Tsonic uses **native .NET types** directly - no wrapper classes. JavaScript semantics come from `Tsonic.Runtime` static helpers.

### Primitives

| TypeScript           | C#        | Notes                   |
| -------------------- | --------- | ----------------------- |
| `number`             | `double`  | Default numeric type    |
| `string`             | `string`  | Native C# string        |
| `boolean`            | `bool`    | Direct mapping          |
| `void`               | `void`    | Direct mapping          |
| `null` / `undefined` | `null`    | Both map to C# null     |
| `any`                | `dynamic` | Runtime type resolution |
| `unknown`            | `object?` | Use with typeof guards  |

### Collections

| TypeScript          | C#        | Notes                             |
| ------------------- | --------- | --------------------------------- |
| `T[]` or `Array<T>` | `List<T>` | Native .NET list + static helpers |
| `Promise<T>`        | `Task<T>` | Native .NET async                 |
| `ReadonlyArray<T>`  | C# `T[]`  | From .NET APIs                    |

---

## Arrays: List<T> + Static Helpers

TypeScript arrays compile to native **`List<T>`**. JavaScript semantics (push, pop, splice, etc.) are provided by **`Tsonic.Runtime.Array`** static methods.

### TypeScript Code

```typescript
const nums: number[] = [1, 2, 3];
nums.push(4);
console.log(nums.length);

// Sparse arrays work too
const sparse: number[] = [];
sparse[10] = 42;
console.log(sparse.length); // 11
```

### Generated C#

```csharp
var nums = new List<double> { 1, 2, 3 };
Tsonic.Runtime.Array.push(nums, 4);
Tsonic.Runtime.console.log(nums.Count);

// Sparse array (fills 0-9 with 0.0)
var sparse = new List<double>();
Tsonic.Runtime.Array.set(sparse, 10, 42);
Tsonic.Runtime.console.log(sparse.Count); // 11
```

**Why List<T>?** Native .NET types enable seamless interop with .NET libraries. You can pass `List<T>` directly to any .NET API that accepts `IList<T>` or `IEnumerable<T>`.

### Array Methods

All JavaScript array methods are available:

```typescript
const doubled = nums.map((x) => x * 2);
const evens = nums.filter((x) => x % 2 === 0);
const first = nums.slice(0, 5);
```

Becomes:

```csharp
var doubled = Tsonic.Runtime.Array.map(nums, (x, i, a) => x * 2);
var evens = Tsonic.Runtime.Array.filter(nums, (x, i, a) => x % 2 == 0);
var first = Tsonic.Runtime.Array.slice(nums, 0, 5);
```

See [Runtime API](runtime.md) for the complete list of array methods.

---

## Strings: Native + Static Helpers

TypeScript `string` maps to native C# `string`. String method calls are rewritten to static helpers:

```typescript
const name = "John Doe";
const upper = name.toUpperCase();
const parts = name.split(" ");
```

```csharp
string name = "John Doe";
string upper = Tsonic.Runtime.String.toUpperCase(name);
List<string> parts = Tsonic.Runtime.String.split(name, " ");
```

**Note:** `split()` returns `List<string>`, not a C# string array.

---

## Optional Types

TypeScript uses `undefined` for optional values. C# uses nullable types:

| TypeScript             | C#        |
| ---------------------- | --------- |
| `string \| undefined`  | `string?` |
| `number \| undefined`  | `double?` |
| `boolean \| undefined` | `bool?`   |

### Example

```typescript
function greet(name?: string): void {
  console.log(name ?? "World");
}

interface User {
  name: string;
  age?: number;
}
```

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
```

---

## C# Numeric Types

You can use precise C# numeric types for better .NET interop:

| TypeScript | C#        | Use Case           |
| ---------- | --------- | ------------------ |
| `int`      | `int`     | 32-bit integers    |
| `long`     | `long`    | 64-bit integers    |
| `decimal`  | `decimal` | Money calculations |
| `byte`     | `byte`    | 0-255 values       |
| `float`    | `float`   | Single precision   |

### Example

```typescript
const count: int = 42;
const price: decimal = 19.99;
const id: long = 1234567890;
```

---

## .NET Library Types

When calling .NET libraries, C# types stay C# types:

```typescript
import { File } from "System.IO";
import { List } from "System.Collections.Generic";

// C# T[] becomes ReadonlyArray<T>
const lines: ReadonlyArray<string> = File.ReadAllLines("file.txt");

// To make mutable, use C# List
const mutable = new List<string>(lines);
mutable.Add("new line"); // C# method

// Pass back to .NET
File.WriteAllLines("output.txt", mutable.ToArray());
```

**Key Point:** Use C# methods (`.Add()`, `.ToArray()`) on C# types, not TypeScript/JavaScript methods.

---

## Async Types

| TypeScript       | C#           |
| ---------------- | ------------ |
| `Promise<T>`     | `Task<T>`    |
| `Promise<void>`  | `Task`       |
| `async function` | `async Task` |

```typescript
async function fetchData(): Promise<string> {
  const result = await getData();
  return result;
}
```

```csharp
public static async Task<string> fetchData()
{
    var result = await getData();
    return result;
}
```

---

## Interfaces and Classes

```typescript
interface User {
  name: string;
  age: number;
}

class UserService {
  getUser(): User {
    return { name: "John", age: 30 };
  }
}
```

```csharp
public class User
{
    public string name { get; set; }
    public double age { get; set; }
}

public class UserService
{
    public User getUser()
    {
        return new User { name = "John", age = 30.0 };
    }
}
```

---

## Generics

Generic type parameters are preserved:

```typescript
function identity<T>(value: T): T {
  return value;
}

class Box<T> {
  constructor(public value: T) {}
}
```

```csharp
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

---

## Type Guards

### typeof

```typescript
if (typeof value === "string") {
  return value.toUpperCase();
}
```

```csharp
if (Tsonic.Runtime.Operators.typeof(value) == "string")
{
    return Tsonic.Runtime.String.toUpperCase((string)value);
}
```

### instanceof

```typescript
if (user instanceof User) {
  console.log(user.name);
}
```

```csharp
if (user is User)
{
    Tsonic.Runtime.console.log(((User)user).name);
}
```

---

## Tuples

```typescript
type Point = [number, number];
const point: Point = [10, 20];

// Named tuples
type Result = [success: boolean, value: string];
```

```csharp
(double, double) point = (10, 20);

// Named tuples
(bool success, string value)
```

---

## Enums

```typescript
enum Color {
  Red = 0,
  Green = 1,
  Blue = 2,
}
```

```csharp
public enum Color
{
    Red = 0,
    Green = 1,
    Blue = 2
}
```

---

## Not Supported (MVP)

These features will error in MVP:

- ❌ Union types (`string | number`)
- ❌ Literal types (`"north" | "south"`)
- ❌ Conditional types
- ❌ Mapped types
- ❌ Template literal types
- ❌ `Date` (use `System.DateTime`)
- ❌ `Map` (use `Dictionary<K,V>`)
- ❌ `Set` (use `HashSet<T>`)
- ❌ `RegExp` (use `System.Text.RegularExpressions.Regex`)

**Workaround for unions:** Use `unknown` with type guards:

```typescript
function process(value: unknown): void {
  if (typeof value === "string") {
    console.log(value.toUpperCase());
  } else if (typeof value === "number") {
    console.log(value * 2);
  }
}
```

---

## See Also

- [Runtime API](runtime.md) - Complete list of Tsonic.Runtime helpers
- [.NET Interop](dotnet-interop.md) - Using .NET libraries
- [Module System](module-system.md) - Imports and exports
