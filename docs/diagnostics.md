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
import { User } from "./models/User.ts";
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
import { User } from "./models/user.ts"; // Wrong case
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

### TSN7420: ref/out/In Are Parameter Modifiers

`ref`, `out`, and `In` are parameter passing modifiers, not types.

```typescript
// Error
function foo(x: ref<number>) {}  // Wrong - ref is not a type

// Correct: Use type annotation on the .NET side
// These are handled via metadata, not TypeScript syntax
```

## TSN5xxx: Numeric Proof Errors

### TSN5101-TSN5109: Numeric Type Errors

Errors related to numeric type narrowing and proof:

| Code    | Error                                      |
| ------- | ------------------------------------------ |
| TSN5101 | Cannot prove numeric narrowing is safe     |
| TSN5102 | Numeric literal out of range               |
| TSN5103 | Mixed numeric types in expression          |
| TSN5104 | Cannot infer numeric type                  |
| TSN5105 | Numeric operation requires same types      |
| TSN5106 | Integer division by zero                   |
| TSN5107 | Numeric overflow possible                  |
| TSN5108 | Cannot narrow to target numeric type       |
| TSN5109 | Numeric type mismatch                      |

## TSN6xxx: Generic Specialization Errors

### TSN6101: Specialization Error

Errors during generic type specialization:

| Code    | Error                                      |
| ------- | ------------------------------------------ |
| TSN6101 | Cannot specialize generic type             |
| TSN6199 | Generic specialization internal error      |

## TSN9xxx: Metadata Loading

### TSN9001-TSN9018: Metadata Errors

Errors loading `.metadata.json` files:

| Code    | Error                                               |
| ------- | --------------------------------------------------- |
| TSN9001 | Metadata file not found                             |
| TSN9002 | Failed to read metadata file                        |
| TSN9003 | Invalid JSON in metadata file                       |
| TSN9004 | Metadata file must be an object                     |
| TSN9005 | Missing or invalid 'namespace' field                |
| TSN9006 | Missing or invalid 'contributingAssemblies' field   |
| TSN9007 | All 'contributingAssemblies' must be strings        |
| TSN9008 | Missing or invalid 'types' field                    |
| TSN9009 | Invalid type: must be an object                     |
| TSN9010 | Invalid type: missing or invalid field              |
| TSN9011 | Invalid type: 'kind' must be one of ...             |
| TSN9012 | Invalid type: 'accessibility' must be one of ...    |
| TSN9013 | Invalid type: field must be a boolean               |
| TSN9014 | Invalid type: 'arity' must be a non-negative number |
| TSN9015 | Invalid type: field must be an array                |
| TSN9016 | Metadata directory not found                        |
| TSN9017 | Not a directory                                     |
| TSN9018 | No .metadata.json files found                       |

### TSN9101-TSN9114: Bindings Errors

Errors loading `.bindings.json` files:

| Code    | Error                                                      |
| ------- | ---------------------------------------------------------- |
| TSN9101 | Bindings file not found                                    |
| TSN9102 | Failed to read bindings file                               |
| TSN9103 | Invalid JSON in bindings file                              |
| TSN9104 | Bindings file must be an object                            |
| TSN9105 | Missing or invalid 'namespace' field                       |
| TSN9106 | Missing or invalid 'types' field                           |
| TSN9107 | Invalid type binding: must be an object                    |
| TSN9108 | Invalid type binding: missing or invalid field             |
| TSN9109 | Invalid type binding: 'metadataToken' must be a number     |
| TSN9110 | Invalid type binding: V1 field must be an array if present |
| TSN9111 | Invalid type binding: V2 field must be an array if present |
| TSN9112 | Bindings directory not found                               |
| TSN9113 | Not a directory                                            |
| TSN9114 | No .bindings.json files found                              |

## Getting Help

If you encounter an error:

1. Check this guide for the specific error code
2. Check the [troubleshooting guide](troubleshooting.md)
3. Search [GitHub issues](https://github.com/tsoniclang/tsonic/issues)
4. Open a new issue with:
   - Error code and message
   - Minimal reproduction case
   - Tsonic version (`tsonic --version`)
