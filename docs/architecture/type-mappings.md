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

## Explicit Numeric Types

From `@tsonic/types`:

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

## Array Types

### JS Mode

```typescript
// TypeScript
const arr: number[] = [1, 2, 3];

// C#
var arr = new Tsonic.Runtime.Array<double>(1, 2, 3);
```

`Array<T>` in JS mode:

- Supports sparse arrays
- Has `.length` property
- Supports `.map()`, `.filter()`, `.reduce()`, etc.

### Dotnet Mode

```typescript
// TypeScript
const arr: number[] = [1, 2, 3];

// C# (depending on context)
var arr = new double[] { 1, 2, 3 };
// or
var arr = new System.Collections.Generic.List<double> { 1, 2, 3 };
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

```typescript
// TypeScript
const point = { x: 10, y: 20 };

// C#
var point = new { x = 10, y = 20 }();
```

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

```typescript
// TypeScript
type Named = { name: string };
type Aged = { age: number };
type Person = Named & Aged;

// C#
public class Person
{
    public string name { get; set; }
    public double age { get; set; }
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
