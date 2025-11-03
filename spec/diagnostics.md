# Diagnostics Catalog

## Error Code Ranges

- **TSN1xxx**: Module resolution & imports
- **TSN2xxx**: Type system & type mappings
- **TSN3xxx**: Unsupported features
- **TSN4xxx**: Code generation
- **TSN5xxx**: Build process
- **TSN6xxx**: Runtime errors

## TSN1xxx - Module Resolution & Imports

### TSN1001 - Missing Extension

**Error:** Local import missing .ts extension

```typescript
import { User } from "./models/User"; // ← Error
```

**Fix:** Add `.ts` extension

```typescript
import { User } from "./models/User.ts"; // ✓
```

### TSN1002 - Import Not Found

**Error:** Cannot resolve import path

```typescript
import { Missing } from "./missing.ts"; // File doesn't exist
```

### TSN1003 - Case Mismatch

**Error:** Import path case doesn't match filesystem

```typescript
// File on disk: ./models/User.ts
import { User } from "./models/user.ts"; // Wrong case
```

### TSN1004 - Node.js Module

**Error:** Node.js built-in modules not supported

```typescript
import fs from "fs"; // Node.js module
import { readFile } from "node:fs"; // Node: prefix
```

**Fix:** Use .NET equivalent

```typescript
import { File } from "System.IO";
```

### TSN1005 - JSON Import

**Error:** JSON imports not supported

```typescript
import config from "./config.json";
```

### TSN1006 - Circular Dependency

**Error:** Circular import detected

```
A.ts imports B.ts
B.ts imports A.ts
```

### TSN1010 - Directory Case Collision

**Error:** Multiple directories with same name (different case)

```
src/
├── models/
└── Models/  // Collision
```

### TSN1011 - Invalid Character in Path

**Error:** Path contains invalid characters

```
src/user-service/  // Hyphen not allowed
src/user.service/  // Period not allowed
```

### TSN1012 - C# Keyword in Path

**Error:** Directory or file name is C# keyword

```
src/namespace/  // C# keyword
src/class.ts    // C# keyword
```

### TSN1013 - Mixed Exports

**Error:** File exports class matching filename plus other members

```typescript
// UserService.ts
export class UserService {} // Matches filename
export function helper() {} // Additional export - Error
```

### TSN1014 - Namespace Collision

**Error:** Local namespace conflicts with .NET namespace

```typescript
// src/System/Text/Helper.ts creates My.App.System.Text
import { JsonSerializer } from "System.Text.Json"; // Conflict
```

### TSN1015 - Non-ASCII Path

**Error:** Non-ASCII characters in path

```
src/用户/  // Chinese characters
```

### TSN1020 - No Entry Point

**Error:** Entry file has top-level code but no main() export

```typescript
// main.ts
console.log("Init");
// No export function main()
```

### TSN1021 - Top-Level Await

**Error:** Top-level await not supported

```typescript
const data = await fetchData(); // At file scope
```

## TSN2xxx - Type System

### TSN2001 - Advanced Type Degraded

**Warning:** Complex TypeScript type simplified

```typescript
type IsString<T> = T extends string ? true : false; // Conditional
```

### TSN2002 - Conditional Type

**Error:** Conditional types not supported

```typescript
type Check<T> = T extends string ? string : number;
```

### TSN2003 - Mapped Type

**Error:** Mapped types not supported

```typescript
type Readonly<T> = { readonly [K in keyof T]: T[K] };
```

### TSN2004 - String Enum

**Error:** String enums not supported

```typescript
enum Status {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
}
```

### TSN2005 - Symbol Type

**Error:** Symbol type not supported

```typescript
const sym: symbol = Symbol();
```

### TSN2006 - BigInt Type

**Error:** BigInt not supported

```typescript
const big: bigint = 123n;
```

### TSN2007 - Intersection Type

**Error:** Intersection types not supported

```typescript
type Combined = TypeA & TypeB;
```

### TSN2008 - Template Literal Type

**Error:** Template literal types not supported

```typescript
type Greeting = `Hello ${string}`;
```

### TSN2009 - Getter/Setter

**Error:** Getters/setters not supported

```typescript
class User {
  get name() {
    return this._name;
  }
  set name(value) {
    this._name = value;
  }
}
```

### TSN2010 - Arrow Property

**Error:** Arrow function properties not supported

```typescript
class Handler {
  handle = () => {}; // Arrow property
}
```

## TSN3xxx - Unsupported Features

### TSN3001 - Re-export

**Error:** Re-exports not supported

```typescript
export * from "./other.ts";
export { foo } from "./bar.ts";
```

### TSN3002 - Default Export

**Error:** Default exports not supported

```typescript
export default class User {}
```

### TSN3003 - Dynamic Import

**Error:** Dynamic imports not supported

```typescript
const module = await import("./dynamic.ts");
```

### TSN3004 - Array Map

**Error:** Array.map() not yet implemented

```typescript
const doubled = arr.map((x) => x * 2);
```

**Fix:** Use for loop

```typescript
const doubled = [];
for (const x of arr) {
  doubled.push(x * 2);
}
```

### TSN3005 - Array Filter

**Error:** Array.filter() not yet implemented

```typescript
const evens = arr.filter((x) => x % 2 === 0);
```

### TSN3006 - Array Reduce

**Error:** Array.reduce() not yet implemented

```typescript
const sum = arr.reduce((a, b) => a + b, 0);
```

### TSN3007 - Object Keys

**Error:** Object.keys() not yet implemented

```typescript
const keys = Object.keys(obj);
```

### TSN3008 - Object Values

**Error:** Object.values() not yet implemented

```typescript
const values = Object.values(obj);
```

### TSN3009 - Object Entries

**Error:** Object.entries() not yet implemented

```typescript
const entries = Object.entries(obj);
```

### TSN3010 - Spread Operator

**Error:** Spread operator not fully supported

```typescript
const combined = { ...obj1, ...obj2 };
```

### TSN3011 - Promise Chaining

**Error:** Promise.then/catch/finally not supported

```typescript
fetchData()
  .then((data) => processData(data))
  .catch((error) => handleError(error))
  .finally(() => cleanup());
```

**Fix:** Use async/await instead

```typescript
async function process() {
  try {
    const data = await fetchData();
    await processData(data);
  } catch (error) {
    handleError(error);
  } finally {
    cleanup();
  }
}
```

**Rationale:** Tsonic maps Promise<T> to Task<T>, which uses async/await pattern rather than chaining.

**Workaround:** Use .NET Task continuation methods if chaining is required:

```typescript
import { Task } from "System.Threading.Tasks";
// Use Task.ContinueWith in C# directly
```

### TSN3012 - super() Not First Statement

**Error:** `super()` call must be the first statement in derived class constructor

```typescript
export class Dog extends Animal {
  constructor(name: string, breed: string) {
    const x = 10; // ← Error: statement before super()
    super(name);
    this.breed = breed;
  }
}
```

**Fix:** Move `super()` to be the first statement

```typescript
export class Dog extends Animal {
  constructor(name: string, breed: string) {
    super(name); // ✓ First statement
    const x = 10;
    this.breed = breed;
  }
}
```

**Rationale:** In C#, the `: base(...)` initializer runs **before** the constructor body executes. TypeScript allows statements before `super()` as long as they don't reference `this`. However, moving these statements to after the base constructor would change execution order and could break code. For semantic correctness, Tsonic requires `super()` to be the first statement.

## TSN4xxx - Code Generation

### TSN4001 - Invalid Identifier

**Error:** Generated identifier would be invalid in C#

```typescript
const class = "test";  // 'class' is C# keyword
```

### TSN4002 - Emit Failed

**Error:** Failed to generate C# code for construct

### TSN4003 - Type Unmappable

**Error:** TypeScript type has no C# equivalent

```typescript
type WeirdType = (() => void) & { prop: string };
```

## TSN5xxx - Build Process

### TSN5001 - dotnet Not Found

**Error:** .NET SDK not installed or not in PATH

```
.NET SDK not found. Install from https://dot.net
```

### TSN5002 - Build Failed

**Error:** dotnet publish failed

```
dotnet publish exited with code 1
```

### TSN5003 - Unsupported RID

**Error:** Runtime identifier not supported for NativeAOT

```bash
tsonic build --rid exotic-os
```

### TSN5004 - Package Not Found

**Error:** NuGet package not found

```
Package 'Unknown.Package' not found
```

### TSN5005 - NativeAOT Error

**Error:** NativeAOT compilation failed

```
ILC: error ILC1005: Failed to compile method
```

## TSN6xxx - Runtime Errors

### TSN6001 - Not Implemented

**Runtime Error:** Feature not implemented in Tsonic.Runtime

```
Array.map() not yet supported. Use a for loop instead.
```

### TSN6002 - Type Mismatch

**Runtime Error:** Type mismatch at runtime

```
Cannot convert System.String to Tsonic.Runtime.String
```

## Diagnostic Format

### Structure

```typescript
interface Diagnostic {
  code: string; // TSN1001
  severity: "error" | "warning" | "info";
  message: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  hint?: string; // Suggested fix
}
```

### Example Output

```
src/models/User.ts:10:25
  10 | import { helper } from "./utils/helper";
     |                        ^^^^^^^^^^^^^^^^
ERROR TSN1001: Local import missing .ts extension

Hint: Add '.ts' extension: "./utils/helper.ts"
```

## Suppression (Future)

```typescript
// @ts-ignore-tsonic TSN3004
const doubled = arr.map(x => x * 2);

// @tsonic-ignore-next-line TSN2001
type Complex = /* complex type */;
```

## Configuration (Future)

```json
{
  "tsonic": {
    "diagnostics": {
      "suppress": ["TSN3004", "TSN3005"],
      "treatWarningsAsErrors": true,
      "maxErrors": 100
    }
  }
}
```
