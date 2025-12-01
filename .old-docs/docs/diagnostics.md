# Diagnostic Error Codes

This guide explains Tsonic's error codes and how to fix them.

## Error Code Format

Tsonic uses diagnostic codes in the format `TSNxxxx`:

- **TSN1xxx** - Module resolution and import errors
- **TSN2xxx** - Type system errors
- **TSN3xxx** - C# keyword and identifier errors
- **TSN4xxx** - .NET interop errors
- **TSN5xxx** - Build and backend errors
- **TSN6xxx** - Internal compiler errors
- **TSN7xxx** - Language semantics and validation errors
- **TSN9xxx** - Metadata and bindings loading errors

---

## TSN1xxx: Module Resolution Errors

### TSN1001: Missing .ts Extension

**Error:** Local import is missing the `.ts` extension.

**Example:**

```typescript
import { User } from "./models/User"; // ❌ Wrong
```

**Fix:**

```typescript
import { User } from "./models/User.ts"; // ✅ Correct
```

**Why:** Tsonic requires explicit `.ts` extensions on all local imports for clarity and ESM compliance.

---

### TSN1002: Wrong Extension

**Error:** Import has an extension other than `.ts`.

**Example:**

```typescript
import { helper } from "./utils.js"; // ❌ Wrong
```

**Fix:**

```typescript
import { helper } from "./utils.ts"; // ✅ Correct
```

---

### TSN1003: Case Mismatch

**Error:** Import path case doesn't match the actual file case on disk.

**Example:**

```typescript
// File: ./models/User.ts
import { User } from "./models/user.ts"; // ❌ Wrong case
```

**Fix:**

```typescript
import { User } from "./models/User.ts"; // ✅ Matches file case
```

**Why:** Case sensitivity prevents issues when deploying to case-sensitive file systems.

---

### TSN1004: Node.js Modules Not Supported

**Error:** Attempting to import Node.js built-in modules.

**Example:**

```typescript
import fs from "fs"; // ❌ Not supported
```

**Fix:** Use .NET equivalents:

```typescript
import { File } from "System.IO"; // ✅ Use .NET
```

---

### TSN1005: JSON Imports Not Supported

**Error:** Trying to import JSON files directly.

**Example:**

```typescript
import config from "./config.json"; // ❌ Not supported in MVP
```

**Fix:** Read JSON at runtime:

```typescript
import { File } from "System.IO";
import { JSON } from "Tsonic.Runtime";

const text = File.ReadAllText("config.json");
const config = JSON.parse(text);
```

---

### TSN1006: Circular Dependency

**Error:** Module dependency cycle detected.

**Example:**

```typescript
// A.ts imports B.ts
// B.ts imports A.ts  // ❌ Circular
```

**Fix:** Refactor to break the cycle - extract shared code to a third module.

---

## TSN2xxx: Type System Errors

### TSN2001: Literal Types Not Supported

**Error:** String or numeric literal types.

**Example:**

```typescript
type Direction = "north" | "south"; // ❌ Not supported in MVP
```

**Fix:** Use enums or string:

```typescript
enum Direction {
  North = "north",
  South = "south",
}
```

---

### TSN2002: Conditional Types Not Supported

**Error:** Conditional type expressions.

**Example:**

```typescript
type Result<T> = T extends string ? string : number; // ❌ Not supported
```

**Fix:** Use explicit types or function overloads.

---

### TSN2003: Mapped Types Not Supported

**Error:** Mapped type transformations.

**Example:**

```typescript
type Readonly<T> = { readonly [K in keyof T]: T[K] }; // ❌ Not supported
```

**Fix:** Define interfaces explicitly.

---

## TSN3xxx: Unsupported Features

### TSN3001: Export All Not Supported

**Error:** Re-export syntax.

**Example:**

```typescript
export * from "./other.ts"; // ❌ Not supported in MVP
```

**Fix:** Export items explicitly:

```typescript
export { Item1, Item2 } from "./other.ts";
```

---

### TSN3002: Default Exports Not Supported

**Error:** Default export syntax.

**Example:**

```typescript
export default class User {} // ❌ Not supported
```

**Fix:** Use named exports:

```typescript
export class User {}
```

---

### TSN3003: Dynamic Imports Not Supported

**Error:** `import()` expressions.

**Example:**

```typescript
const module = await import("./dynamic.ts"); // ❌ Not supported
```

**Fix:** Use static imports only.

---

## TSN7xxx: Language Semantics Errors

These errors relate to Tsonic's language semantics and type system validation.

### TSN7301: Class Cannot Implement Nominalized Interface

**Error:** Attempting to use `implements` with a TypeScript interface.

**Example:**

```typescript
interface Printable {
  print(): void;
}

class Document implements Printable {
  // ❌ TSN7301: Class cannot implement 'Printable'
  print(): void {
    console.log("printing...");
  }
}
```

**Why:** In Tsonic, TypeScript interfaces are "nominalized" to C# classes (not C# interfaces). This allows object literals to use C# object initializer syntax. Since interfaces become classes, you cannot "implement" them - C# classes cannot implement other classes.

**Fix options:**

1. **Use `extends` for inheritance:**

```typescript
interface Printable {
  print(): void;
}

class Document extends Printable {
  // ✅ Works - inherits from Printable class
  print(): void {
    console.log("printing...");
  }
}
```

2. **Use composition:**

```typescript
interface Printable {
  print(): void;
}

class Document {
  private printer: Printable;

  constructor(printer: Printable) {
    this.printer = printer;
  }

  print(): void {
    this.printer.print();
  }
}
```

3. **Use duck typing (just define matching methods):**

```typescript
class Document {
  // Just define the method - no interface needed
  print(): void {
    console.log("printing...");
  }
}
```

**Note:** The special `struct` marker interface is exempt from this rule - `implements struct` is allowed to mark value types.

---

## Getting Help

If you encounter an error not listed here:

1. Check the [troubleshooting guide](troubleshooting.md)
2. Search existing GitHub issues
3. Open a new issue with:
   - Error code and message
   - Minimal reproduction case
   - Tsonic version

---

**See Also:**

- [Troubleshooting Guide](troubleshooting.md) - Common issues
- [Language Reference](language/module-system.md) - ESM rules
- [Type Mappings](language/type-mappings.md) - Supported types
