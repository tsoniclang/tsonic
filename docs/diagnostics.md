# Diagnostic Error Codes

Tsonic uses diagnostic codes in the format `TSNxxxx` to identify specific errors.

## Error Code Ranges

| Range   | Category                          |
| ------- | --------------------------------- |
| TSN1xxx | Module resolution and imports     |
| TSN2xxx | Type system errors                |
| TSN3xxx | C# identifier and keyword errors  |
| TSN4xxx | .NET interop errors               |
| TSN5xxx | NativeAOT and runtime errors      |
| TSN6xxx | Internal compiler errors          |
| TSN7xxx | Language semantics and validation |
| TSN9xxx | Metadata and bindings loading     |

## TSN1xxx: Module Resolution

### TSN1001: Missing .ts Extension

Local imports must use the `.ts` extension.

```typescript
// Wrong
import { User } from "./models/User";

// Correct
import { User } from "./models/User.js";
```

### TSN1002: Circular Dependency

Modules have a circular import dependency.

```typescript
// A.ts imports B.ts
// B.ts imports A.ts  // Circular
```

**Fix:** Extract shared code to a third module.

### TSN1003: Case Mismatch

Import path case doesn't match file on disk.

```typescript
// File: ./models/User.ts
import { User } from "./models/user.js"; // Wrong case
```

### TSN1004: Module Not Found

Referenced module doesn't exist.

### TSN1005: Conflicting Exports

Multiple modules export the same name creating ambiguity.

### TSN1006: Invalid Namespace

The import specifier doesn't form a valid namespace.

## TSN2xxx: Type System

### TSN2001: Unsupported TypeScript Feature

Feature not supported in Tsonic.

```typescript
// Examples of unsupported features:
type Readonly<T> = { readonly [K in keyof T]: T[K] }; // Mapped types
type Result<T> = T extends string ? string : number; // Conditional types
```

### TSN2002: Invalid Type Mapping

Type cannot be mapped to C#.

### TSN2003: Name Conflict

File name conflicts with an exported member name.

```typescript
// File: User.ts
export class User {} // Conflicts with file name
```

**Fix:** Rename either the file or the export.

## TSN3xxx: C# Identifiers

### TSN3001: C# Reserved Keyword

Identifier uses a C# reserved keyword.

```typescript
// "class", "namespace", "event", etc. are reserved in C#
const event = "click"; // Error
```

### TSN3002: Invalid C# Identifier

Identifier cannot be used in C#.

### TSN3011: Promise Chaining Not Supported

`.then()`, `.catch()`, `.finally()` are not supported.

```typescript
// Wrong
promise.then((result) => doSomething(result));

// Correct - use async/await
const result = await promise;
doSomething(result);
```

## TSN4xxx: .NET Interop

### TSN4001: .NET Interop Error

Error accessing .NET types or members.

### TSN4002: Missing .NET Type Declaration

.NET type is used but not declared in typings.

## TSN5xxx: NativeAOT/Runtime

### TSN5001: NativeAOT Limitation

Code uses feature incompatible with NativeAOT.

### TSN5002: Runtime Implementation Missing

Required runtime feature not available.

## TSN6xxx: Internal Compiler

### TSN6001: Internal Compiler Error

Unexpected error in compilation. Please report this as a bug.

## TSN7xxx: Language Semantics

### TSN7101: Recursive Mapped Types

Recursive mapped types are not supported.

### TSN7102: Conditional Types with Infer

Conditional types using `infer` are not supported.

### TSN7103: `this` Typing

`this` type expressions are not supported.

### TSN7104: Generic Constructor Constraints

Generic constructor constraints with rest parameters are not supported.

### TSN7105: Type Specialization

Cannot determine required type specializations for generics.

### TSN7201: Recursive Structural Alias

Recursive structural type aliases are not supported.

### TSN7202: Conditional Alias Resolution

Conditional type alias cannot be resolved statically.

### TSN7203: Symbol Keys

Symbol keys in objects are not supported.

### TSN7204: Variadic Generic Interface

Variadic generic interfaces are not supported.

### TSN7301: Implements Nominalized Interface

Classes cannot implement TypeScript interfaces directly.

```typescript
interface Printable {
  print(): void;
}

class Document implements Printable {
  // Error
  print(): void {}
}
```

In Tsonic, TypeScript interfaces become C# classes. Use `extends` instead:

```typescript
class Document extends Printable {
  // Correct
  print(): void {}
}
```

Or use composition/duck typing.

### TSN7401: `any` Type Not Supported

The `any` type cannot be used. Provide explicit types.

```typescript
// Wrong
function process(data: any) {}

// Correct
function process(data: unknown) {}
function process(data: string) {}
```

### TSN7403: Object Literal Requires Type

Object literals need a contextual nominal type, OR must be eligible for auto-synthesis.

**Auto-synthesized (no error):**

```typescript
const point = { x: 1, y: 2 }; // OK - synthesizes __Anon_file_1_1
const handler = { process: (x: number) => x * 2 }; // OK - arrow functions allowed
const config = { name: "test", count: 42 }; // OK - property assignments
```

**Requires explicit type (error):**

```typescript
const obj = {
  foo() {
    return 1;
  },
}; // Error - method shorthand not allowed
const obj = {
  get x() {
    return 1;
  },
}; // Error - getters not allowed
```

Use arrow function syntax for function properties, or provide explicit type annotation:

```typescript
interface Point {
  x: number;
  y: number;
}
const obj: Point = { x: 1, y: 2 }; // Explicit type annotation
```

### TSN7405: Untyped Lambda Parameter

Lambda parameters require explicit type annotations when contextual type cannot be inferred.

**Contextual inference works (no error):**

```typescript
const numbers = [1, 2, 3];
const doubled = numbers.map((x) => x * 2); // OK - x inferred as number
const filtered = items.filter((item) => item.active); // OK - item inferred

const callback: (n: number) => number = (x) => x * 2; // OK - typed variable
```

**Requires explicit types (error):**

```typescript
const fn = (x) => x * 2; // Error - no contextual type available

// Fix: Add explicit type annotation
const fn = (x: number): number => x * 2;
```

### TSN7413: Dictionary Key Type

Dictionary keys must be `string` or `number` type.

```typescript
// OK
const byName: Record<string, User> = {};
const byId: Record<number, User> = {};

interface StringDict {
  [key: string]: number;
}

interface NumberDict {
  [key: number]: string;
}

// Error
const bySymbol: Record<symbol, User> = {}; // Symbols not supported
```

### TSN7406: Mapped Types Not Supported

Mapped types (utility types that transform properties) are not supported.

```typescript
// Error
type ReadonlyUser = Readonly<User>;
type PartialConfig = Partial<Config>;
type RequiredFields = Required<OptionalFields>;

// Fix: Create explicit interface with desired properties
interface ReadonlyUser {
  readonly name: string;
  readonly email: string;
}
```

### TSN7407: Conditional Types Not Supported

Conditional types are not supported.

```typescript
// Error
type Result<T> = T extends string ? StringResult : OtherResult;
type NonNullable<T> = T extends null | undefined ? never : T;

// Fix: Use explicit type unions or separate types
type StringResult = { kind: "string"; value: string };
type OtherResult = { kind: "other"; value: unknown };
```

### TSN7410: Intersection Types Not Supported

Intersection types (`A & B`) are not supported.

```typescript
// Error
type Combined = TypeA & TypeB;
type WithTimestamp = User & { timestamp: number };

// Fix: Create explicit interface combining both types
interface Combined {
  // Include all members from TypeA
  // Include all members from TypeB
}

interface UserWithTimestamp {
  name: string;
  email: string;
  timestamp: number;
}
```

### TSN7408: Mixed Variadic Tuples Not Supported

Variadic tuple types with mixed elements are not supported.

```typescript
// Error
type Mixed = [string, ...number[]];

// Fix: Use a regular array or fixed tuple
type Fixed = [string, number, number];
type NumberArray = number[];
```

### TSN7409: 'infer' Keyword Not Supported

The `infer` keyword in conditional types is not supported.

```typescript
// Error
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

// Fix: Use explicit type parameters or overloads
```

### TSN7414: Type Cannot Be Represented

The type cannot be represented in the compiler's type subset.

```typescript
// Error: Complex types that can't map to C#
type Complex = { [K in keyof T]: T[K] };

// Fix: Use simpler, explicit type definitions
```

### TSN7415: Nullable Union with Unconstrained Generic

Nullable unions with unconstrained generic type parameters cannot be represented in C#.

```typescript
// Error
function getValue<T>(value: T | null): T {
  return value ?? getDefault();
}

// The problem: In C#, T? for an unconstrained type parameter T
// does not provide nullability for value types.
// If T is int, then T? is still int (not Nullable<int>)
```

**Why this happens:**

In C#, nullable generics work differently based on constraints:

- `T? where T : struct` → `Nullable<T>` (works for value types)
- `T? where T : class` → nullable reference (works for reference types)
- `T?` with no constraint → just `T` for value types (no nullability!)

**Fix options:**

1. **Use `object | null`** to box the value:

```typescript
function getValue<T>(value: object | null): T {
  return (value ?? getDefault()) as T;
}
```

2. **Add a constraint** if T is always a reference type:

```typescript
function getValue<T extends object>(value: T | null): T {
  return value ?? getDefault();
}
```

3. **Use `struct` constraint** if T is always a value type:

```typescript
function getValue<T extends struct>(value: T | null): T {
  return value ?? getDefault();
}
```

> **See also:** [Troubleshooting Guide](troubleshooting.md#nullable-generics) for more patterns.

### TSN7417: Empty Array Literal Requires Type

Empty array literals must have a type annotation. Tsonic cannot infer the element type of an empty array.

```typescript
// Error
const arr = []; // What type are the elements?

// Correct
const arr: number[] = [];
const strings: string[] = [];
const items: Array<User> = [];
```

**Why this is required:**

In TypeScript, `[]` is inferred as `any[]` or contextually typed. In Tsonic, we compile to C# where arrays have fixed element types at compile time. Without a type annotation, we cannot determine what C# type to generate.

**Patterns that work without annotation:**

```typescript
// Non-empty arrays infer the type from elements
const numbers = [1, 2, 3]; // Tsonic infers: int[]
const mixed = [1, 2.5, 3]; // Inferred as double[]
const largeNumbers = [1, 2147483648]; // Inferred as long[] (element exceeds int range)

// Function return types provide context
function getNumbers(): number[] {
  return []; // OK - contextual type from return type
}
```

### TSN7418: Invalid char Value

`char` represents the CLR type `System.Char` (imported from `@tsonic/core/types.js`).

TypeScript models `char` as `string` for compatibility, so Tsonic validates `char` **during compilation**:

- A `char` value must be a **single-character string literal** (including escapes like `"\\n"`), or
- A value that is already typed as `char` (for example, from APIs that return `char`).

```typescript
import { char } from "@tsonic/core/types.js";

function takesChar(c: char): void {}

takesChar("A"); // OK
// takesChar("AB"); // TSN7418 (multi-character literal)

const s = "hello";
// takesChar(s);    // TSN7418 (not a literal / not char-typed)
takesChar(s[0]);    // OK (context expects char)
```

**Fix:** Use a single-character literal in a `char` position, or obtain a `char` from an API returning `char` (for example `System.Char.parse("Q")`).

### TSN7421: Anonymous Object Type Not Lowered

Internal compiler error indicating an anonymous object type was not properly lowered to a synthesized class. This is a compiler bug - please report it.

### TSN7422: Object Rest Requires Finite Object Shape

Object rest patterns (`...rest`) require a known, finite set of properties to determine what goes in the rest object.

```typescript
// Error: Cannot determine rest shape
function process(obj: Record<string, unknown>): void {
  const { id, ...rest } = obj; // Error - infinite keys possible
}

// OK: Finite shape known
interface User {
  id: number;
  name: string;
  email: string;
}
function process(user: User): void {
  const { id, ...rest } = user; // OK - rest is { name, email }
}
```

### TSN7423: Unsupported Destructuring Pattern

The destructuring pattern is not supported. This may include:

- Computed property keys in destructuring
- Patterns that cannot be lowered to C#

### TSN7430: Arrow Function Requires Explicit Types (Escape Hatch)

Arrow functions can only infer parameter and return types from context when they meet the "simple arrow" criteria:

1. Not async
2. Expression body (not block body)
3. All parameters are simple identifiers (no destructuring)
4. No default parameter values
5. No rest parameters

**Contextual inference works (no error):**

```typescript
const numbers = [1, 2, 3];
const doubled = numbers.map((x) => x * 2); // OK - simple arrow with context
const filtered = items.filter((item) => item.active); // OK

const callback: (n: number) => number = (x) => x * 2; // OK - typed variable
```

**Requires explicit types (error):**

```typescript
// No contextual type
const fn = (x) => x * 2; // Error - no context for inference

// Block body (not expression body)
items.map((x) => {
  const y = x + 1;
  return y;
}); // Error - block body requires explicit return type

// Async arrow
items.map(async (x) => await fetch(x)); // Error - async requires explicit types

// Destructuring pattern
items.map(({ id, name }) => id + name); // Error - destructuring requires explicit types

// Default parameter
items.map((x = 0) => x * 2); // Error - defaults require explicit types

// Rest parameter
items.map((...args) => args.length); // Error - rest requires explicit types
```

**Fix: Add explicit type annotations:**

```typescript
// For block bodies, add return type
items.map((x): number => {
  const y = x + 1;
  return y;
});

// For complex arrows, fully annotate
const fn = (x: number): number => x * 2;
```

### TSN7431: Cannot Infer Arrow Return Type

The arrow function's return type cannot be inferred safely. This occurs when the body expression produces an unsafe type (any, unknown, or anonymous structural type).

```typescript
// Error: Return type is 'any' or 'unknown'
items.map((x) => someAnyFunction(x)); // Cannot infer return type

// Error: Return type is anonymous object type
items.map((x) => ({ id: x, name: "test" })); // Anonymous type needs nominal type
```

**Fix: Provide explicit return type annotation:**

```typescript
interface Result {
  id: number;
  name: string;
}

items.map((x): Result => ({ id: x, name: "test" }));
```

## TSN5xxx: Numeric Proof Errors

### TSN5101-TSN5110: Numeric Type Errors

Errors related to numeric type narrowing and proof:

| Code    | Error                                          |
| ------- | ---------------------------------------------- |
| TSN5101 | Cannot prove numeric narrowing is safe         |
| TSN5102 | Numeric literal out of range                   |
| TSN5103 | Binary operation produces wrong numeric type   |
| TSN5104 | Cannot narrow from source to target type       |
| TSN5105 | Unproven numeric type at parameter boundary    |
| TSN5106 | Unproven numeric type at return boundary       |
| TSN5107 | Array index must be Int32                      |
| TSN5108 | Value exceeds JS safe integer range            |
| TSN5109 | Computed access kind not classified (ICE)      |
| TSN5110 | Integer literal cannot be implicitly converted |

## TSN6xxx: Yield Lowering Errors

### TSN6101: Yield Expression in Unsupported Position

The yield expression is in a position that cannot be lowered to C# iterators.

```typescript
// Error: yield in expression position
const x = (yield 1) + 2; // Not supported

// OK: yield as statement
yield 1;
const x = yield; // Bidirectional yield
```

## TSN9xxx: Type Universe Resolution

Tsonic resolves nominal types (including stdlib types like `System.String`) through loaded CLR bindings (`<Namespace>/bindings.json` in tsbindgen packages).

### TSN9001: Missing Stdlib Type (fatal)

Emitted when a required stdlib type cannot be found in the loaded bindings. This is **fatal** because the compiler cannot safely proceed.

Fixes:

- Ensure `@tsonic/dotnet` + `@tsonic/globals` are installed
- Run `tsonic restore` to refresh bindings and NuGet closure

### TSN9002: Unknown Type (error)

Emitted when a nominal type name cannot be resolved from bindings. This is recoverable: Tsonic substitutes `unknown` so it can continue analysis and report additional issues.

## Getting Help

If you encounter an error:

1. Check this guide for the specific error code
2. Check the [troubleshooting guide](troubleshooting.md)
3. Search [GitHub issues](https://github.com/tsoniclang/tsonic/issues)
4. Open a new issue with:
   - Error code and message
   - Minimal reproduction case
   - Tsonic version (`tsonic --version`)
