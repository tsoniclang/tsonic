# Type Mappings

How TypeScript types are converted to C# types.

## Primitive Types

| TypeScript  | C#       | Notes                 |
| ----------- | -------- | --------------------- |
| `number`    | `double` | 64-bit floating point |
| `string`    | `string` | .NET System.String    |
| `boolean`   | `bool`   | .NET System.Boolean   |
| `null`      | `null`   | Nullable reference    |
| `undefined` | `null`   | Maps to null          |
| `void`      | `void`   | No return value       |
| `never`     | N/A      | Compile error         |
| `any`       | N/A      | Not supported         |
| `unknown`   | `object` | Base object type      |

## Explicit CLR Types

From `@tsonic/core` (numeric + other CLR primitives):

| TypeScript | C#        | .NET Type      |
| ---------- | --------- | -------------- |
| `int`      | `int`     | System.Int32   |
| `float`    | `float`   | System.Single  |
| `long`     | `long`    | System.Int64   |
| `byte`     | `byte`    | System.Byte    |
| `short`    | `short`   | System.Int16   |
| `uint`     | `uint`    | System.UInt32  |
| `ulong`    | `ulong`   | System.UInt64  |
| `decimal`  | `decimal` | System.Decimal |
| `char`     | `char`    | System.Char    |

## Array Types

Arrays emit as native C# arrays:

```typescript
// TypeScript
const arr: number[] = [1, 2, 3];
const strings: Array<string> = ["a", "b"];

// C#
double[] arr = [1, 2, 3];
string[] strings = ["a", "b"];
```

Both `T[]` and `Array<T>` syntax emit as native arrays.

### List<T> for Dynamic Collections

Use `List<T>` when you need add/remove operations:

```typescript
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";

const list = new List<number>();
list.Add(1);
list.Add(2);
list.Add(3);
list.Add(4);
```

## Tuple Types

```typescript
// TypeScript
const point: [number, number] = [10, 20];
const record: [string, number, boolean] = ["name", 42, true];

// C#
ValueTuple<double, double> point = (10, 20);
ValueTuple<string, double, bool> record = ("name", 42, true);
```

Tuples with 8+ elements use nested ValueTuple with TRest.

## Dictionary and HashSet Types

Tsonic does not include JavaScript `Map`/`Set` in the default globals. Use .NET collections:

```typescript
import {
  Dictionary,
  HashSet,
} from "@tsonic/dotnet/System.Collections.Generic.js";

// TypeScript
const map = new Dictionary<string, number>();
const set = new HashSet<number>();

// C#
var map = new Dictionary<string, double>();
var set = new HashSet<double>();
```

## Generic Types

### Type Parameters

```typescript
// TypeScript
function identity<T>(x: T): T { return x; }

// C#
public static T identity<T>(T x) { return x; }
```

### Generic Classes

```typescript
// TypeScript
class Box<T> {
  constructor(private value: T) {}
  get(): T { return this.value; }
}

// C#
public class Box<T>
{
    private T value;
    public Box(T value) { this.value = value; }
    public T get() { return value; }
}
```

### Type Constraints

```typescript
// TypeScript
interface HasId { id: number; }
function getId<T extends HasId>(item: T): number {
  return item.id;
}

// C#
public static double getId<T>(T item) where T : HasId
{
    return item.id;
}
```

### Null in Generic Contexts

In generic contexts, `null` emits as `default` to handle both reference and value types:

```typescript
// TypeScript
function orNull<T>(value: T): T | null {
  return condition ? value : null;
}

// C#
public static T orNull<T>(T value)
{
    return condition ? value : default;
}
```

## Function Types

### Function Signatures

```typescript
// TypeScript
type Handler = (event: Event) => void;

// C#
// Func<Event, void> doesn't exist, so:
// Action<Event>

type Transform<T, U> = (input: T) => U;
// C#: Func<T, U>
```

### Mapping Table

| TypeScript          | C#              |
| ------------------- | --------------- |
| `() => void`        | `Action`        |
| `(a: T) => void`    | `Action<T>`     |
| `() => T`           | `Func<T>`       |
| `(a: T) => U`       | `Func<T, U>`    |
| `(a: T, b: U) => V` | `Func<T, U, V>` |

## Object Types

### Interfaces

```typescript
// TypeScript
interface User {
  id: number;
  name: string;
  email?: string;
}

// C#
public class User
{
    public double id { get; set; }
    public string name { get; set; }
    public string? email { get; set; }
}
```

### Anonymous Objects

Simple object literals auto-synthesize nominal types:

```typescript
// TypeScript
const point = { x: 10, y: 20 };

// C# (synthesized class generated)
// class __Anon_File_Line_Col {
//     public double x { get; set; }
//     public double y { get; set; }
// }
var point = new __Anon_File_Line_Col { x = 10, y = 20 };
```

Method shorthand and getters/setters require explicit type annotation.

## Union Types

### Nullable Unions

```typescript
// TypeScript
type MaybeString = string | null;

// C#
string?
```

### Discriminated Unions

```typescript
// TypeScript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// C# (generates base class + variants)
public abstract class Result<T> { }
public class ResultOk<T> : Result<T>
{
    public bool ok => true;
    public T value { get; set; }
}
public class ResultError<T> : Result<T>
{
    public bool ok => false;
    public string error { get; set; }
}
```

### General Unions

```typescript
// TypeScript
type StringOrNumber = string | number;

// C# (fallback to object)
object;
```

## Intersection Types

**NOT SUPPORTED** - Intersection types (`A & B`) cannot be compiled to C#.

```typescript
// Error TSN7410
type Named = { name: string };
type Aged = { age: number };
type Person = Named & Aged; // Not supported
```

**Workaround:** Create an explicit interface combining both types:

```typescript
interface Person {
  name: string;
  age: number;
}
```

## Literal Types

```typescript
// TypeScript
type Direction = "north" | "south" | "east" | "west";

// C# (string constants or enum)
// Context-dependent
```

## Enum Types

### Numeric Enums

```typescript
// TypeScript
enum Status {
  Pending = 0,
  Active = 1,
  Complete = 2
}

// C#
public enum Status
{
    Pending = 0,
    Active = 1,
    Complete = 2
}
```

### String Enums

```typescript
// TypeScript
enum Color {
  Red = "red",
  Green = "green"
}

// C# (class with constants)
public static class Color
{
    public const string Red = "red";
    public const string Green = "green";
}
```

## CLR Type Mappings

When importing .NET types:

| Import            | C# Type                                      |
| ----------------- | -------------------------------------------- |
| `List<T>`         | `System.Collections.Generic.List<T>`         |
| `Dictionary<K,V>` | `System.Collections.Generic.Dictionary<K,V>` |
| `HashSet<T>`      | `System.Collections.Generic.HashSet<T>`      |
| `Task<T>`         | `System.Threading.Tasks.Task<T>`             |
| `DateTime`        | `System.DateTime`                            |
| `TimeSpan`        | `System.TimeSpan`                            |
| `Guid`            | `System.Guid`                                |

## Special Considerations

### Optional Properties

```typescript
interface Config {
  required: string;
  optional?: number;
}
```

`optional` becomes nullable: `double?`

### Readonly Properties

```typescript
interface Point {
  readonly x: number;
  readonly y: number;
}
```

Generated with only getter: `public double x { get; }`

### Async/Await

```typescript
async function getData(): Promise<string> {
  return "data";
}
```

Becomes:

```csharp
public static async Task<string> getData()
{
    return "data";
}
```

## Generator Types

### Simple Generators

```typescript
// TypeScript
function* counter(): Generator<number> {
  yield 1;
  yield 2;
}
```

Becomes:

```csharp
public static IEnumerable<double> counter()
{
    yield return 1.0;
    yield return 2.0;
}
```

### Bidirectional Generators

```typescript
// TypeScript
function* acc(): Generator<number, void, number> {
  let total = 0;
  while (true) {
    const v = yield total;
    total += v;
  }
}
```

Generates wrapper classes for bidirectional communication:

```csharp
// Exchange class for passing values
public sealed class acc_exchange { ... }

// Wrapper with JS-style API
public sealed class acc_Generator {
    public IteratorResult<double> next(double? value = default) { ... }
    public IteratorResult<double> @return(object? value = default) { ... }
}
```

### Async Generators

```typescript
// TypeScript
async function* stream(): AsyncGenerator<string> {
  yield "a";
  yield "b";
}
```

Becomes:

```csharp
public static IAsyncEnumerable<string> stream()
{
    // async iterator implementation
}
```

> **See also:** [Generators Guide](../generators.md) for complete documentation.
