# Language Reference

Complete TypeScript → C# language mapping for Tsonic.

---

## Overview

This section documents how TypeScript language features map to C#. In `mode: "js"`, Tsonic preserves **exact JavaScript semantics** through the `Tsonic.JSRuntime` library. In `mode: "dotnet"` (default), built-in methods compile directly to .NET BCL equivalents.

---

## Core Language Features

### [Modules](modules.md)

ESM module system with `.ts` extensions:

- Import/export syntax
- Module resolution rules
- Default vs named exports
- Namespace imports
- Re-exports

**Key Rule**: Local imports MUST have `.ts` extension

### [Types](types.md)

Type system and mappings:

- Primitive types (number, string, boolean, null, undefined)
- Arrays and tuples
- Objects and interfaces (nominalized to C# classes)
- Union and intersection types
- Type aliases (nominalized to C# classes)
- Literal types

**Key Rules**:

- `number` always maps to `double`
- Interfaces and type aliases become C# classes (not interfaces)

### [Expressions](expressions.md)

All expression forms:

- Literals (number, string, boolean, null, undefined)
- Identifiers and member access
- Function calls and method calls
- Operators (arithmetic, comparison, logical)
- Conditional (ternary) operator
- Template literals
- Array and object literals
- Spread operator
- Destructuring

### [Statements](statements.md)

Control flow and declarations:

- Variable declarations (const, let)
- If/else statements
- Switch statements
- For loops (for, for-of, for-in)
- While loops
- Try/catch/finally
- Return, break, continue
- Throw statements

**Key Rule**: Only `const` for immutable variables (functional style preferred)

### [Functions](functions.md)

Function declarations and expressions:

- Function declarations
- Arrow functions
- Function expressions
- Optional parameters
- Rest parameters
- Default parameters
- Overloading (via union types)
- Higher-order functions

### [Classes](classes.md)

Object-oriented programming:

- Class declarations
- Constructors
- Methods (instance and static)
- Properties (instance and static)
- Access modifiers (public, private, protected)
- Inheritance (extends)
- Abstract classes
- Getters and setters

### Interfaces and Nominalization

**Key Rule**: TypeScript interfaces map to C# classes (not C# interfaces)

TypeScript interfaces are structural types - any object with matching properties satisfies the interface. C# requires nominal types for object initialization. Tsonic "nominalizes" TypeScript interfaces to C# classes so that:

1. Object literals can use C# object initializer syntax (`new Type { ... }`)
2. Interface types can be used in variable declarations and return types
3. Generic type arguments work correctly

**Example**:

```typescript
// TypeScript
interface User {
  name: string;
  age: number;
}

function createUser(name: string, age: number): User {
  return { name: name, age: age };
}
```

```csharp
// Generated C# - interface becomes class
public class User
{
    public string name { get; set; }
    public double age { get; set; }
}

public static User createUser(string name, double age)
{
    return new User { name = name, age = age };
}
```

**Implications**:

- Interfaces are **not** C# interfaces - they cannot be implemented by multiple classes
- Using `class Foo implements Bar` where `Bar` is an interface will produce error **TSN7301**
- Type aliases for object shapes behave the same way
- Anonymous object types remain as C# anonymous types (`new { ... }`)
- This is a **deliberate semantic shift** from structural to nominal typing

**When to use**:

- Use interfaces for data transfer objects (DTOs), records, and value objects
- Use classes when you need methods, inheritance, or polymorphism
- Both compile to C# classes; the distinction is conceptual in TypeScript

### [Generics](generics.md)

Parametric polymorphism:

- Generic functions
- Generic classes
- Generic interfaces
- Type constraints
- Monomorphization (not runtime generics)

**Key Concept**: Each generic instantiation becomes a concrete type

### [Async/Await](async.md)

Asynchronous programming:

- async functions
- await expressions
- Promises
- Promise.all, Promise.race
- Error handling in async code

**Mapping**: TypeScript `Promise<T>` → C# `Task<T>`

---

## Limitations

### [Unsupported Features](limitations.md)

TypeScript features NOT supported in Tsonic:

- Decorators
- Symbols
- Proxies
- WeakMap/WeakSet
- eval and Function constructor
- with statement
- var hoisting
- Prototypal inheritance

See [Limitations](limitations.md) for complete list and rationale.

---

## Language Quick Reference

### Type Mappings

| TypeScript    | C# Output           | Runtime Behavior                  |
| ------------- | ------------------- | --------------------------------- |
| `number`      | `double`            | IEEE 754 64-bit float             |
| `string`      | `string`            | UTF-16, immutable                 |
| `boolean`     | `bool`              | true/false                        |
| `null`        | `null`              | Null reference                    |
| `undefined`   | `TSUndefined.Value` | Singleton value                   |
| `void`        | `void`              | No return value                   |
| `T[]`         | `List<T>`           | Dynamic array with JS semantics\* |
| `any`         | `object`            | Dynamic typing (discouraged)      |
| `unknown`     | `object`            | Type-safe any                     |
| `never`       | `void`              | Unreachable code                  |
| `interface X` | `class X`           | Nominalized to C# class\*\*       |
| `type X = {}` | `class X`           | Nominalized to C# class\*\*       |

\*When `mode: "js"`, array methods like `push()` use `Tsonic.JSRuntime` extension methods. When `mode: "dotnet"` (default), they compile to BCL equivalents (e.g., `push()` → `Add()`).

\*\*TypeScript interfaces and type aliases are nominalized to C# classes. This allows object literals to use C# object initializer syntax (`new Type { ... }`). See [Interfaces and Nominalization](#interfaces-and-nominalization) for details.

### Arrays

| TypeScript         | C# Output               | Notes                          |
| ------------------ | ----------------------- | ------------------------------ |
| `number[]`         | `List<double>`          | Dynamic array                  |
| `Array<string>`    | `List<string>`          | Same as `string[]`             |
| `[number, string]` | `Tuple<double, string>` | `System.Tuple<double, string>` |

### Functions

| TypeScript              | C# Output                        |
| ----------------------- | -------------------------------- |
| `function f() {}`       | `public static void f()`         |
| `const f = () => {}`    | `var f = () => {}`               |
| `function f(): number`  | `public static double f()`       |
| `function f(x: number)` | `public static void f(double x)` |

### Classes

| TypeScript             | C# Output                    |
| ---------------------- | ---------------------------- |
| `class User {}`        | `public class User`          |
| `private name: string` | `private string name`        |
| `public age: number`   | `public double age`          |
| `static count: number` | `public static double count` |
| `extends Base`         | `: Base`                     |

---

## Semantics Preservation

Tsonic guarantees JavaScript semantics for:

### 1. Array Behavior

```typescript
// TypeScript
const arr = [];
arr[10] = "x";
console.log(arr.length); // 11
console.log(arr[5]); // undefined
```

```csharp
// Generated C# (mode: "js" - for exact JS sparse array semantics)
using Tsonic.JSRuntime;
var arr = new List<string>();
arr[10] = "x";  // Extension method handles sparse indexing
Console.WriteLine(arr.length);  // 11
Console.WriteLine(arr[5]);      // undefined
```

### 2. Number Behavior

```typescript
// TypeScript
const a = 1;
const b = 2.5;
console.log(a + b); // 3.5
console.log(1 / 3); // 0.3333...
```

```csharp
// Generated C# (always double)
double a = 1.0;
double b = 2.5;
Console.WriteLine(a + b);  // 3.5
Console.WriteLine(1.0 / 3.0);  // 0.3333...
```

### 3. String Behavior

```typescript
// TypeScript
const name = "Alice";
console.log(name.length); // 5
console.log(name[0]); // "A"
console.log(name.toUpperCase()); // "ALICE"
```

```csharp
// Generated C# (C# strings already match)
string name = "Alice";
Console.WriteLine(name.Length);  // 5
Console.WriteLine(name[0]);      // 'A'
Console.WriteLine(name.ToUpper());  // "ALICE"
```

---

## Module System

### Import Rules

```typescript
// ✅ CORRECT - Local import with .ts
import { User } from "./models/User.ts";

// ✅ CORRECT - .NET import without extension
import { File } from "System.IO";

// ❌ WRONG - Missing .ts extension
import { User } from "./models/User"; // ERROR TSN1001

// ❌ WRONG - .ts on .NET import
import { File } from "System.IO.ts"; // Makes no sense
```

### Export Rules

```typescript
// Named exports
export const PI = 3.14159;
export function add(a: number, b: number): number {
  return a + b;
}
export class User {}

// Default export
export default class User {}

// Re-export
export { User } from "./models/User.ts";
export * from "./utils.ts";
```

---

## Compiler Behavior

### Type Checking

Tsonic performs full TypeScript type checking:

```typescript
// ✅ Valid
const x: number = 42;

// ❌ Type error
const y: number = "hello"; // TSN2001: Type 'string' not assignable to 'number'
```

### Null Safety

TypeScript's `strictNullChecks` is enforced:

```typescript
// ✅ Valid
let x: string | null = null;

// ❌ Type error
let y: string = null; // TSN2002: Type 'null' not assignable to 'string'
```

### Monomorphization

Generics are monomorphized (not erased):

```typescript
// TypeScript
function identity<T>(x: T): T {
  return x;
}

const a = identity<number>(42);
const b = identity<string>("hello");
```

```csharp
// Generated C# (separate functions)
public static double identity_number(double x) {
  return x;
}

public static string identity_string(string x) {
  return x;
}

var a = identity_number(42.0);
var b = identity_string("hello");
```

---

## Coding Style

### Functional Programming Preferred

```typescript
// ✅ PREFERRED - Immutable
const doubled = numbers.map((n) => n * 2);

// ❌ DISCOURAGED - Mutable
let result = [];
for (let i = 0; i < numbers.length; i++) {
  result.push(numbers[i] * 2);
}
```

### Const over Let

```typescript
// ✅ PREFERRED
const user = { name: "Alice", age: 30 };

// ❌ DISCOURAGED (unless truly needed)
let counter = 0;
counter++;
```

---

## Error Handling

### Result Types Preferred

```typescript
// ✅ PREFERRED - Explicit errors
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return { ok: false, error: "Division by zero" };
  }
  return { ok: true, value: a / b };
}
```

### Try-Catch for .NET

```typescript
// ✅ CORRECT - Catch .NET exceptions
import { File } from "System.IO";

try {
  const content = File.ReadAllText("file.txt");
} catch (error) {
  console.log(`Error: ${error}`);
}
```

---

## See Also

### Architecture Documentation (Implementation Details)

- **[Module Resolution](architecture/03-phase-resolver.md)** - How imports are resolved internally
- **[Type System](architecture/05-phase-ir.md)** - Type conversion implementation
- **[Code Generation](architecture/07-phase-emitter.md)** - How TypeScript becomes C#
- **[Runtime Implementation](architecture/09-phase-runtime.md)** - Tsonic.JSRuntime internals

### User Documentation

- **[.NET Integration](dotnet-reference.md)** - Using .NET libraries
- **[Configuration](configuration.md)** - tsonic.json format
- **[Contracts](contracts.md)** - Stable public interfaces
- **[Guide](guide/)** - Tutorial-style introduction
- **[Examples](examples/)** - Complete code examples
