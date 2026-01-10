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
import { int, float, long, byte, short, char } from "@tsonic/core/types.js";

const count: int = 42; // System.Int32
const ratio: float = 3.14; // System.Single
const big: long = 9999999999; // System.Int64
const small: byte = 255; // System.Byte
const medium: short = 32000; // System.Int16
const letter: char = "A"; // System.Char
```

> **See also:** [Numeric Types Guide](numeric-types.md) for complete coverage of integer types, narrowing patterns, and when to use integers vs numbers.

### char (System.Char)

Tsonic supports `char` (a distinct CLR primitive: `System.Char`) via `@tsonic/core`.

TypeScript represents `char` as `string` for TSC compatibility, so Tsonic enforces **char validity** during compilation:

- A `char` value must be a **single-character string literal** (`"A"`, `"\\n"`, `"'"`, etc.), or
- A value that is already typed as `char` (e.g., from an API returning `char`).

If you pass a non-literal `string` (or a multi-character literal) where `char` is expected, Tsonic emits `TSN7418`.

```ts
import { char, int } from "@tsonic/core/types.js";
import { Console, Char } from "@tsonic/dotnet/System.js";

function takesChar(c: char): void {
  Console.writeLine(c);
}

takesChar("Z"); // OK
// takesChar("ZZ"); // TSN7418

const s = "hello";
const c: char = s[0]; // OK (context expects char)

const parsed: char = Char.parse("Q"); // Use parsing for dynamic strings
void parsed;
```

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
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";

const list = new List<number>();
list.add(1);
list.add(2);
list.add(3);
// Generated: var list = new List<double>(); list.Add(...);

// Or create empty and add items
const names = new List<string>();
names.add("Alice");
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

## Dictionary and HashSet

Tsonic does not include JavaScript `Map`/`Set` in the default globals. Use .NET collections:

```typescript
import { Dictionary, HashSet } from "@tsonic/dotnet/System.Collections.Generic.js";

const userMap = new Dictionary<string, User>();
userMap.add("alice", alice);
userMap.containsKey("bob"); // boolean
userMap.remove("alice");
userMap.clear();
const dictSize = userMap.count;

const ids = new HashSet<number>();
ids.add(1);
ids.add(2);
const hasOne = ids.contains(1); // true
ids.remove(1);
ids.clear();
const setSize = ids.count;

void dictSize;
void setSize;
```

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
public static T Identity<T>(T value)
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
public static async Task<string> FetchData()
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

Prefer numeric type annotations to control emitted CLR numeric types:

```typescript
import { int, byte, short, long, float } from "@tsonic/core/types.js";

const intValue: int = 1000;
const byteValue: byte = 255;
const shortValue: short = 1000;
const longValue: long = 1000000;
const floatValue: float = 1.5;
const doubleValue: number = 1.5;
```

Generates CLR numeric declarations:

```csharp
int intValue = 1000;
byte byteValue = 255;
short shortValue = 1000;
long longValue = 1000000L;
float floatValue = 1.5f;
double doubleValue = 1.5;
```

> **See also:** [Numeric Types Guide](numeric-types.md) for complete coverage of numeric casting and overflow behavior.

### Reference Type Assertions

Downcast reference types:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

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
public static Dog GetDog(Animal animal)
{
    return (Dog)animal;
}

public static Animal CastFromObject(object obj)
{
    return (Animal)obj;
}
```

### Safe Casting with trycast

Use `trycast<T>(value)` for safe type casting that returns `null` on failure instead of throwing:

```typescript
class Animal {
  name!: string;
}

class Dog extends Animal {
  breed!: string;
}

function tryGetDog(animal: Animal): Dog | null {
  return trycast<Dog>(animal);
}

function process(animal: Animal): void {
  const dog = trycast<Dog>(animal);
  if (dog !== null) {
    Console.writeLine(dog.breed);
  }
}
```

Generates C# `as` operator:

```csharp
public static Dog? TryGetDog(Animal animal)
{
    return animal as Dog;
}

public static void Process(Animal animal)
{
    var dog = animal as Dog;
    if (dog != null)
    {
        Console.WriteLine(dog.breed);
    }
}
```

**Difference from type assertions:**

| Syntax              | C# Code      | On Failure                    |
| ------------------- | ------------ | ----------------------------- |
| `value as T`        | `(T)value`   | Throws `InvalidCastException` |
| `trycast<T>(value)` | `value as T` | Returns `null`                |

Use `trycast` when:

- The cast might fail at runtime
- You want to check before using the result
- You're implementing type guards or polymorphic patterns

## Anonymous Objects

Tsonic automatically synthesizes nominal classes for anonymous object type literals.

### Inline Object Types

When you use object type literals inline, Tsonic generates named classes:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function createPoint(): { x: number; y: number } {
  return { x: 10, y: 20 };
}

function processData(data: { id: number; name: string }): void {
  Console.writeLine(data.name);
}
```

Generates synthesized classes:

```csharp
// Auto-generated record class
public record CreatePoint_Return(double X, double Y);

public record ProcessData_data(double Id, string Name);

public static CreatePoint_Return CreatePoint()
{
    return new CreatePoint_Return(10, 20);
}

public static void ProcessData(ProcessData_data data)
{
    Console.WriteLine(data.Name);
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
  return 0;
}
```

Generates:

```csharp
public static int ProcessValue(int? value)
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
