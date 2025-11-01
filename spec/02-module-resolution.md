# Module Resolution

## Fundamental Rule

**Every import is either:**
1. **Local TypeScript** - MUST have `.ts` extension
2. **.NET Namespace** - MUST NOT have extension, uses dotted notation

**No fallbacks, no guessing, no magic.**

## Local TypeScript Imports

### Valid Local Imports

```typescript
// Relative imports - MUST have .ts extension
import { User } from "./models/User.ts";
import { helper } from "../utils/helper.ts";
import { config } from "../../config.ts";

// Absolute imports (if tsconfig paths configured) - MUST have .ts extension
import { logger } from "@utils/logger.ts";  // Resolves via tsconfig paths
```

### Invalid Local Imports - ERROR

```typescript
import { User } from "./models/User";       // ERROR TSN1001: Missing .ts extension
import { helper } from "../utils/helper.js"; // ERROR TSN1002: .js not supported
import { config } from "config";             // ERROR TSN1001: Missing extension
```

### Resolution Algorithm

1. Parse import path
2. Check for extension:
   - Has `.ts` → Local TypeScript import
   - Has other extension → ERROR TSN1002
   - No extension → Check if .NET (see below)
3. For local imports:
   - Resolve relative to current file
   - Check file exists on disk
   - Verify exact case match
4. Track dependency for compilation

### Case Sensitivity

**File system case MUST match import case exactly:**

```typescript
// File on disk: ./models/User.ts

import { User } from "./models/User.ts";   // ✓ OK
import { User } from "./models/user.ts";   // ERROR TSN1003: Case mismatch
import { User } from "./Models/User.ts";   // ERROR TSN1003: Case mismatch
```

## .NET Namespace Imports

### Detection Rules

An import is treated as .NET if:
1. **No file extension** AND
2. **Cannot resolve to a local file** AND
3. **Contains dots** (e.g., `System.Text.Json`) OR starts with known .NET namespaces

### Valid .NET Imports

```typescript
import { JsonSerializer } from "System.Text.Json";
import { File, Directory } from "System.IO";
import { DbContext } from "Microsoft.EntityFrameworkCore";
import { List } from "System.Collections.Generic";
```

### .NET Import Processing

1. Add to module's `dotnetUsings` list
2. Emit as C# `using` statement
3. No validation at compile time (dotnet will validate)

## Export/Import Semantics

### Named Exports

```typescript
// math.ts
export const PI = 3.14;
export function add(a: number, b: number) { return a + b; }
export class Calculator { }
```

```typescript
// main.ts
import { PI, add, Calculator } from "./math.ts";
```

### Export All (Re-exports)

**NOT SUPPORTED in MVP:**
```typescript
export * from "./other.ts";     // ERROR TSN3001
export { foo } from "./bar.ts";  // ERROR TSN3001
```

### Default Exports

**NOT SUPPORTED:**
```typescript
export default class User { }    // ERROR TSN3002
import User from "./User.ts";    // ERROR TSN3002
```

## Module Index Building

For each discovered module, track:

```typescript
interface ModuleIndex {
  path: string;           // "./src/models/User.ts"
  namespace: string;      // "My.App.models"
  className: string;      // "User"
  exports: Map<string, ExportInfo>;
  imports: ImportInfo[];
  dotnetUsings: string[];
}

interface ExportInfo {
  name: string;
  kind: 'class' | 'function' | 'const' | 'interface';
  type: IrType;
}

interface ImportInfo {
  module: string;         // "./helper.ts" or "System.IO"
  names: string[];        // ["helper", "utils"]
  isLocal: boolean;       // true for .ts imports
}
```

## Import Resolution Examples

### Example 1: Mixed Imports

```typescript
// src/services/data.ts
import { User } from "../models/User.ts";        // Local
import { JsonSerializer } from "System.Text.Json"; // .NET
import { File } from "System.IO";                 // .NET

export class DataService {
  save(user: User) {
    const json = JsonSerializer.Serialize(user);
    File.WriteAllText("user.json", json);
  }
}
```

Generates:

```csharp
using My.App.models;
using System.Text.Json;
using System.IO;

namespace My.App.services
{
    public class DataService
    {
        public void save(User user)
        {
            var json = JsonSerializer.Serialize(user);
            File.WriteAllText("user.json", json);
        }
    }
}
```

### Example 2: Resolution Errors

```typescript
// These all fail
import utils from "./utils";           // ERROR TSN1001: Missing .ts extension
import { helper } from "./Helper.ts";  // ERROR TSN1003: Case mismatch (file is helper.ts)
import { foo } from "./missing.ts";    // ERROR TSN1002: File not found
```

## Special Cases

### Node.js Built-ins

**NOT SUPPORTED** - Use .NET equivalents:

```typescript
import fs from "fs";                    // ERROR TSN1004: Node.js modules not supported
import { readFile } from "node:fs";     // ERROR TSN1004

// Instead, use:
import { File } from "System.IO";
```

### JSON Imports

**NOT SUPPORTED in MVP:**
```typescript
import data from "./data.json";         // ERROR TSN1005: JSON imports not supported
```

### Dynamic Imports

**NOT SUPPORTED:**
```typescript
const module = await import("./dynamic.ts"); // ERROR TSN3003: Dynamic imports not supported
```

## Compilation Order

1. Start from entry file
2. Parse and collect all imports
3. Recursively process imported modules
4. Build dependency graph
5. Compile in topological order (dependencies first)
6. Detect circular dependencies → ERROR TSN1006