# Module System

Tsonic uses ES Modules (ESM) with strict import rules to ensure clarity and predictability.

## The Golden Rule

**All local imports MUST include the `.ts` extension.**

```typescript
// ✅ Correct
import { User } from "./models/User.ts";

// ❌ Wrong - will not compile
import { User } from "./models/User";
```

## Why .ts Extensions?

Unlike Node.js or bundlers that automatically resolve extensions, Tsonic requires explicit `.ts` extensions for:

1. **Clarity** - No ambiguity about what you're importing
2. **ESM Standard** - Aligns with browser ESM which requires extensions
3. **Build Performance** - No need to check multiple file extensions
4. **Type Safety** - Immediate feedback if the file doesn't exist

## Import Types

Tsonic recognizes two types of imports:

### 1. Local TypeScript Imports

Any import with a `.ts` extension is treated as a local TypeScript module:

```typescript
// Relative imports
import { User } from "./User.ts";
import { helper } from "../utils/helper.ts";
import { config } from "../../config.ts";

// Each will be compiled to C# and linked
```

**Rules:**

- Must end with `.ts`
- Path is relative to current file
- Case must match file exactly
- File must exist at compile time

### 2. .NET Namespace Imports

Imports without extensions that can't be resolved as local files are treated as .NET namespaces:

```typescript
// .NET imports - no extension
import { File } from "System.IO";
import { JsonSerializer } from "System.Text.Json";
import { List } from "System.Collections.Generic";
```

**Rules:**

- No extension
- Uses dotted notation
- Resolves to C# `using` statements
- Validated by .NET compiler, not Tsonic

## Examples

### Same Directory

```typescript
// File structure:
// src/
//   main.ts
//   User.ts

// In main.ts:
import { User } from "./User.ts"; // ✅
```

### Parent Directory

```typescript
// File structure:
// src/
//   config.ts
//   models/
//     User.ts

// In models/User.ts:
import { config } from "../config.ts"; // ✅
```

### Nested Paths

```typescript
// File structure:
// src/
//   app/
//     services/
//       UserService.ts
//     models/
//       User.ts

// In services/UserService.ts:
import { User } from "../models/User.ts"; // ✅
```

### Mixed Imports

```typescript
// Local TypeScript
import { User } from "./models/User.ts";

// .NET namespaces
import { File } from "System.IO";
import { JsonSerializer } from "System.Text.Json";

export class UserService {
  save(user: User) {
    const json = JsonSerializer.Serialize(user);
    File.WriteAllText("user.json", json);
  }
}
```

## What's Not Supported

### No Extension Omission

```typescript
// ❌ Not allowed
import { User } from "./User";
import { helper } from "../utils/helper";
```

### No .js Extensions

```typescript
// ❌ Not allowed
import { User } from "./User.js";
```

### No CommonJS

```typescript
// ❌ Not allowed
const User = require("./User.ts");
module.exports = { User };
```

### No Dynamic Imports

```typescript
// ❌ Not allowed
const module = await import("./dynamic.ts");
```

### No Default Exports

```typescript
// ❌ Not allowed
export default class User {}
import User from "./User.ts";

// ✅ Use named exports
export class User {}
import { User } from "./User.ts";
```

### No Re-exports (MVP)

```typescript
// ❌ Not allowed in MVP
export * from "./other.ts";
export { foo } from "./bar.ts";

// ✅ Import and re-export explicitly
import { foo, bar } from "./other.ts";
export { foo, bar };
```

## Common Errors

### TSN1001: Missing Extension

```
Error TSN1001: Local import missing .ts extension
  import { User } from "./User"
                       ^^^^^^^^
```

**Fix:** Add `.ts` extension

### TSN1002: Wrong Extension

```
Error TSN1002: Import has invalid extension
  import { User } from "./User.js"
                       ^^^^^^^^^^^
```

**Fix:** Change to `.ts`

### TSN1003: Case Mismatch

```
Error TSN1003: Import case doesn't match file
  import { User } from "./user.ts"  // File is User.ts
                       ^^^^^^^^^^^
```

**Fix:** Match the exact case of the file

## See Also

- [Namespaces](namespaces.md) - How files map to C# namespaces
- [Type Mappings](type-mappings.md) - TypeScript → C# types
- [.NET Interop](dotnet-interop.md) - Using .NET libraries
- [Diagnostics](../diagnostics.md) - All error codes
