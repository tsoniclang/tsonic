# Type System

How TypeScript types map to C# types in Tsonic.

## Primitive Types

### Default Mappings

| TypeScript | C# Type |
|------------|---------|
| `number` | `double` |
| `string` | `string` |
| `boolean` | `bool` |
| `null` | `null` |
| `undefined` | `null` |
| `void` | `void` |
| `never` | N/A (compile error) |
| `any` | Not supported |
| `unknown` | `object` |

### Explicit Numeric Types

Use `@tsonic/types` for precise numeric control:

```typescript
import { int, float, long, byte, short } from "@tsonic/types";

const count: int = 42;        // System.Int32
const ratio: float = 3.14;    // System.Single
const big: long = 9999999999; // System.Int64
const small: byte = 255;      // System.Byte
const medium: short = 32000;  // System.Int16
```

### Number Handling

```typescript
// Default: number → double
const x = 42;        // double
const y = 3.14;      // double
const z = x / 4;     // 10.5 (floating point division)

// Integer math
import { int } from "@tsonic/types";
const a: int = 42;
const b: int = 4;
const c = a / b;     // Integer division in C#
```

## Arrays

### JS Mode

```typescript
// Array<T> or T[]
const numbers: number[] = [1, 2, 3];
const strings: Array<string> = ["a", "b"];

// Generated: Tsonic.Runtime.Array<double>
```

### Dotnet Mode

```typescript
import { List } from "@tsonic/dotnet/System.Collections.Generic";

const list = new List<number>();
// Generated: System.Collections.Generic.List<double>
```

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

## Union Types

### Simple Unions

```typescript
type StringOrNumber = string | number;
```

Generates `object` with runtime type checking.

### Discriminated Unions

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
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

## Enums

### Numeric Enums

```typescript
export enum Status {
  Pending,    // 0
  Active,     // 1
  Completed   // 2
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
  Blue = "blue"
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
const x = 42;           // Inferred: number
const s = "hello";      // Inferred: string
const arr = [1, 2, 3];  // Inferred: number[]
```

Explicit types recommended for:
- Function parameters
- Function return types
- Complex objects

## Unsupported Types

| Type | Reason | Alternative |
|------|--------|-------------|
| `any` | No type safety | Use `unknown` or specific type |
| `symbol` | No C# equivalent | Use string keys |
| `bigint` | Limited support | Use `long` |
| Mapped types | Complex transform | Define explicitly |
| Conditional types | Complex transform | Define explicitly |
