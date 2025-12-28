# Type System

How TypeScript types map to C# types in Tsonic.

## Primitive Types

### Default Mappings

| TypeScript  | C# Type             |
| ----------- | ------------------- |
| `number`    | `double`            |
| `string`    | `string`            |
| `boolean`   | `bool`              |
| `null`      | `null`              |
| `undefined` | `null`              |
| `void`      | `void`              |
| `never`     | N/A (compile error) |
| `any`       | Not supported       |
| `unknown`   | `object`            |

### Explicit Numeric Types

Use `@tsonic/core` for precise numeric control:

```typescript
import { int, float, long, byte, short } from "@tsonic/core/types.js";

const count: int = 42; // System.Int32
const ratio: float = 3.14; // System.Single
const big: long = 9999999999; // System.Int64
const small: byte = 255; // System.Byte
const medium: short = 32000; // System.Int16
```

> **See also:** [Numeric Types Guide](numeric-types.md) for complete coverage of integer types, narrowing patterns, and when to use integers vs numbers.

### Number Handling

```typescript
// Default: number → double
const x = 42; // double
const y = 3.14; // double
const z = x / 4; // 10.5 (floating point division)

// Integer math
import { int } from "@tsonic/core/types.js";
const a: int = 42;
const b: int = 4;
const c = a / b; // Integer division in C#
```

## Arrays

### Native Arrays

Arrays emit as C# native arrays (`T[]`):

```typescript
// Array<T> or T[] syntax both emit as native arrays
const numbers: number[] = [1, 2, 3];
const strings: Array<string> = ["a", "b"];

// Generated: double[] numbers = [1, 2, 3];
// Generated: string[] strings = ["a", "b"];
```

### List<T> for Dynamic Collections

For collections that need add/remove operations, use `List<T>`:

```typescript
import { List } from "@tsonic/dotnet/System.Collections.Generic";

const list = new List<number>([1, 2, 3]);
// Generated: new List<double>([1, 2, 3])

// Or create empty and add items
const names = new List<string>();
names.Add("Alice");
```

## Tuples

Fixed-length arrays with specific element types:

```typescript
const point: [number, number] = [10, 20];
const record: [string, number, boolean] = ["name", 42, true];
```

Generates `ValueTuple<T1, T2, ...>` in C#:

```csharp
ValueTuple<double, double> point = (10.0, 20.0);
ValueTuple<string, double, bool> record = ("name", 42.0, true);
```

Supports up to 8 elements. Access via `.Item1`, `.Item2`, etc.

## Objects and Interfaces

### Interface to Class

```typescript
export interface User {
  id: number;
  name: string;
  email?: string;
}
```

Generates:

```csharp
public class User
{
    public double id { get; set; }
    public string name { get; set; }
    public string? email { get; set; }
}
```

### Optional Properties

```typescript
interface Config {
  required: string;
  optional?: number;
}
```

Optional properties become nullable in C#:

```csharp
public string required { get; set; }
public double? optional { get; set; }
```

## Map and Set

### Map<K, V>

```typescript
const userMap = new Map<string, User>();
userMap.set("alice", alice);
const user = userMap.get("alice");
userMap.has("bob"); // boolean
userMap.delete("alice");
userMap.clear();
console.log(userMap.size);
```

Generates `Dictionary<TKey, TValue>` in C#.

### Set<T>

```typescript
const ids = new Set<number>();
ids.add(1);
ids.add(2);
const hasOne = ids.has(1); // true
ids.delete(1);
ids.clear();
console.log(ids.size);
```

Generates `HashSet<T>` in C#.

## Dictionary Types

### Record<K, V>

```typescript
const scores: Record<string, number> = { alice: 100, bob: 95 };
const ages: Record<number, string> = { 1: "one", 2: "two" };
```

Key type must be `string` or `number`. Generates `Dictionary<TKey, TValue>`.

### Index Signatures

```typescript
interface StringDict {
  [key: string]: number;
}

interface NumberDict {
  [key: number]: string;
}
```

Both generate `Dictionary<TKey, TValue>` with appropriate key types.

## Union Types

### Simple Unions

```typescript
type StringOrNumber = string | number;
```

Generates `object` with runtime type checking.

### Discriminated Unions

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
```

Generates separate classes with a common base.

### Nullable Types

```typescript
type MaybeString = string | null;
type OptionalNumber = number | undefined;
```

Both become `string?` and `double?` respectively.

## Generics

### Generic Functions

```typescript
export function identity<T>(value: T): T {
  return value;
}
```

Generates:

```csharp
public static T identity<T>(T value)
{
    return value;
}
```

### Generic Classes

```typescript
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

### Generic Constraints

```typescript
interface HasId {
  id: number;
}

export function getId<T extends HasId>(item: T): number {
  return item.id;
}
```

Generates `where T : HasId` constraint in C#.

### Null Handling in Generics

In generic contexts, `null` is emitted as `default` to correctly handle both reference and value types:

```typescript
function getOrDefault<T>(value: T | null, fallback: T): T {
  return value ?? fallback;
}

function createEmpty<T>(): T | null {
  return null; // Emits: return default;
}
```

This ensures generics work correctly whether `T` is a class, struct, or primitive.

## Function Types

### Function Signatures

```typescript
type Callback = (value: number) => void;
type Transformer<T, U> = (input: T) => U;
```

Generates:

```csharp
// Action<double> for Callback
// Func<T, U> for Transformer
```

> **See also:** [Callbacks Guide](callbacks.md) for complete coverage of Action, Func, and higher-order function patterns.

### Async Functions

```typescript
export async function fetchData(): Promise<string> {
  return "data";
}
```

Generates:

```csharp
public static async Task<string> fetchData()
{
    return "data";
}
```

> **See also:** [Async Patterns Guide](async-patterns.md) for async/await, for-await loops, and async generators.

## Enums

### Numeric Enums

```typescript
export enum Status {
  Pending, // 0
  Active, // 1
  Completed, // 2
}
```

Generates:

```csharp
public enum Status
{
    Pending = 0,
    Active = 1,
    Completed = 2
}
```

### String Enums

```typescript
export enum Color {
  Red = "red",
  Green = "green",
  Blue = "blue",
}
```

Generates a class with string constants.

## Type Aliases

### Simple Aliases

```typescript
export type UserId = number;
export type UserName = string;
```

Aliases are resolved at compile time.

### Complex Aliases

```typescript
export type Point = { x: number; y: number };
export type Handler = (event: Event) => void;
```

## Readonly and Const

```typescript
interface Config {
  readonly apiUrl: string;
}

const MAX_SIZE = 100;
```

- `readonly` becomes `{ get; }` (no setter)
- `const` becomes `const` or `static readonly`

## Type Inference

Tsonic infers types where possible:

```typescript
const x = 42; // Inferred: number
const s = "hello"; // Inferred: string
const arr = [1, 2, 3]; // Inferred: number[]
```

Explicit types recommended for:

- Function parameters
- Function return types
- Complex objects

## Type Assertions

Use the `as` keyword to perform type conversions.

### Numeric Type Assertions

Convert between numeric types explicitly:

```typescript
import { int, byte, short, long, float } from "@tsonic/core/types.js";

// Literal to specific numeric type
const intValue = 1000 as int;
const byteValue = 255 as byte;
const shortValue = 1000 as short;
const longValue = 1000000 as long;
const floatValue = 1.5 as float;
const doubleValue = 1.5 as number;
```

Generates C# casts:

```csharp
int intValue = (int)1000;
byte byteValue = (byte)255;
short shortValue = (short)1000;
long longValue = (long)1000000;
float floatValue = (float)1.5;
double doubleValue = 1.5;
```

> **See also:** [Numeric Types Guide](numeric-types.md) for complete coverage of numeric casting and overflow behavior.

### Reference Type Assertions

Downcast reference types:

```typescript
class Animal {
  name!: string;
}

class Dog extends Animal {
  breed!: string;
}

function getDog(animal: Animal): Dog {
  return animal as Dog;
}

function castFromObject(obj: object): Animal {
  return obj as Animal;
}
```

Generates C# casts:

```csharp
public static Dog getDog(Animal animal)
{
    return (Dog)animal;
}

public static Animal castFromObject(object obj)
{
    return (Animal)obj;
}
```

## Anonymous Objects

Tsonic automatically synthesizes nominal classes for anonymous object type literals.

### Inline Object Types

When you use object type literals inline, Tsonic generates named classes:

```typescript
function createPoint(): { x: number; y: number } {
  return { x: 10, y: 20 };
}

function processData(data: { id: number; name: string }): void {
  console.log(data.name);
}
```

Generates synthesized classes:

```csharp
// Auto-generated record class
public record createPoint_Return(double x, double y);

public record processData_data(double id, string name);

public static createPoint_Return createPoint()
{
    return new createPoint_Return(10, 20);
}

public static void processData(processData_data data)
{
    Console.WriteLine(data.name);
}
```

### When to Use Named Interfaces

For reusable types, prefer explicit interfaces:

```typescript
// ✅ Preferred for reusable types
interface Point {
  x: number;
  y: number;
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}
```

Use anonymous object types for:

- One-off return types
- Function-specific parameters
- Intermediate data shapes

## Nullable Narrowing

TypeScript null checks automatically narrow types in C#.

### Reference Types

```typescript
function greet(name: string | null): string {
  if (name !== null) {
    return `Hello, ${name}`;
  }
  return "Hello, stranger";
}
```

### Value Types

Nullable value types require `.Value` access after null checks in C#. Tsonic handles this automatically:

```typescript
import { int } from "@tsonic/core/types.js";

function processValue(value: int | null): int {
  if (value !== null) {
    return value * 2; // Narrowed to int
  }
  return 0 as int;
}
```

Generates:

```csharp
public static int processValue(int? value)
{
    if (value != null)
    {
        return value.Value * 2;  // .Value access
    }
    return 0;
}
```

> **See also:** [.NET Interop Guide](dotnet-interop.md#nullable-value-type-narrowing) for compound conditions and advanced nullable patterns.

## Unsupported Types

| Type               | Reason            | Alternative                    |
| ------------------ | ----------------- | ------------------------------ |
| `any`              | No type safety    | Use `unknown` or specific type |
| `symbol`           | No C# equivalent  | Use string keys                |
| `bigint`           | Limited support   | Use `long`                     |
| Mapped types       | Complex transform | Define explicitly              |
| Conditional types  | Complex transform | Define explicitly              |
| Intersection types | No C# equivalent  | Create combined interface      |
