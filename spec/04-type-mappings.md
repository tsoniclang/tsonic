# Type Mappings

## Primitive Types

| TypeScript  | C#           | Notes                                               |
| ----------- | ------------ | --------------------------------------------------- |
| `number`    | `double`     | All numbers are double-precision                    |
| `string`    | `string`     | When methods used, may need `Tsonic.Runtime.String` |
| `boolean`   | `bool`       | Direct mapping                                      |
| `void`      | `void`       | Direct mapping                                      |
| `undefined` | `default(T)` | Becomes default value for type                      |
| `null`      | `null`       | C# null                                             |
| `any`       | `object`     | Loss of type safety                                 |
| `unknown`   | `object`     | Same as any for MVP                                 |
| `never`     | `void`       | Or custom `Never` type if needed                    |

## Built-in Objects

All JavaScript built-in objects map to their `Tsonic.Runtime` equivalents with **exact names**:

| TypeScript   | C#                               | Implementation                |
| ------------ | -------------------------------- | ----------------------------- |
| `T[]`        | `Tsonic.Runtime.Array<T>`        | Sparse arrays, mutable length |
| `Array<T>`   | `Tsonic.Runtime.Array<T>`        | Same as T[]                   |
| `Date`       | `Tsonic.Runtime.Date`            | JS Date semantics             |
| `RegExp`     | `Tsonic.Runtime.RegExp`          | JS regex behavior             |
| `Map<K,V>`   | `Tsonic.Runtime.Map<K,V>`        | JS Map semantics              |
| `Set<T>`     | `Tsonic.Runtime.Set<T>`          | JS Set semantics              |
| `Promise<T>` | `System.Threading.Tasks.Task<T>` | Direct async mapping          |
| `Error`      | `System.Exception`               | Base error type               |

## Array Types

### TypeScript Arrays → Tsonic.Runtime.Array

```typescript
// TypeScript
const nums: number[] = [1, 2, 3];
nums.push(4);
nums[10] = 99; // Sparse array
```

```csharp
// C#
var nums = new Tsonic.Runtime.Array<double>(1, 2, 3);
nums.push(4);
nums[10] = 99;  // Sparse array supported
```

## String Types

### When to use Tsonic.Runtime.String

String literals and basic operations use C# `string`:

```typescript
const name: string = "John";
const greeting = "Hello " + name;
```

```csharp
string name = "John";
var greeting = "Hello " + name;
```

When JS string methods are used, wrap in `Tsonic.Runtime.String`:

```typescript
const lower = name.toLowerCase();
const parts = name.split(" ");
```

```csharp
var lower = new Tsonic.Runtime.String(name).toLowerCase();
var parts = new Tsonic.Runtime.String(name).split(new Tsonic.Runtime.String(" "));
```

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

Union types use `Tsonic.Runtime.Union<T1, T2>`:

```typescript
// TypeScript
type StringOrNumber = string | number;
function process(value: StringOrNumber) {
  if (typeof value === "string") {
    console.log(value.toLowerCase());
  } else {
    console.log(value * 2);
  }
}
```

```csharp
// C# (simplified - actual would use Union<T1,T2>.Match)
public static void process(Tsonic.Runtime.Union<string, double> value)
{
    // Implementation depends on Union.Match pattern
}
```

**Note:** Union types beyond 2 types not supported in MVP.

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

```typescript
if (typeof value === "string") {
}
```

```csharp
if (value is string) { }
```

### instanceof

```typescript
if (value instanceof User) {
}
```

```csharp
if (value is User) { }
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
var x = 5.0;
var name = "John";
var arr = new Tsonic.Runtime.Array<double>(1, 2, 3);
```

## Unsupported Types (MVP)

These generate errors:

- `symbol` - ERROR TSN2005
- `bigint` - ERROR TSN2006
- Intersection types (`A & B`) - ERROR TSN2007
- Conditional types - ERROR TSN2002
- Mapped types - ERROR TSN2003
- Template literal types - ERROR TSN2008
