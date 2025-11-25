# Tsonic Compiler Architecture

## 1. System Overview

### What is Tsonic?

**Tsonic** is a TypeScript-to-C#-to-NativeAOT compiler that produces fast, self-contained native executables using .NET's NativeAOT technology. It is primarily a **TypeScript syntax frontend for .NET**, with an optional JavaScript semantics mode for built-in types.

**Key Characteristics:**

- **TypeScript Source** → **C# Code** → **Native Binary**
- **.NET-First**: Uses native .NET types (List<T>, string, double), not JavaScript runtime ports
- **Mode-Based Built-in Routing**:
  - **.NET mode** (`mode: "dotnet"`, default): Built-in methods use BCL semantics
  - **JavaScript mode** (`mode: "js"`): Built-in methods use `Tsonic.JSRuntime` extension methods
- **ESM-Only**: Strict `.ts` extension requirement on all local imports
- **Functional Codebase**: Pure functions, immutable data structures throughout
- **NativeAOT Output**: Single-file executables with no runtime dependencies

### Example

**TypeScript Input:**

```typescript
// src/main.ts
import { File } from "System.IO";
import { Console } from "System";

export function main() {
  const lines = File.ReadAllLines("data.txt");
  Console.WriteLine(`Read ${lines.length} lines`);

  const nums = [1, 2, 3];
  nums.push(4);
  Console.WriteLine(nums.join(", "));
}
```

**Generated C# (with `mode: "dotnet"` - default):**

```csharp
// Generated/MyApp/main.cs
using System;
using System.IO;
using System.Collections.Generic;

namespace MyApp;

public static class main {
  public static void mainFunction() {
    var lines = File.ReadAllLines("data.txt");
    Console.WriteLine($"Read {lines.Length} lines");

    var nums = new List<double> { 1.0, 2.0, 3.0 };
    nums.Add(4.0);  // push() → Add() in dotnet mode
    Console.WriteLine(string.Join(", ", nums));  // join() → string.Join() in dotnet mode
  }
}
```

**Generated C# (with `mode: "js"`):**

```csharp
// Generated/MyApp/main.cs
using Tsonic.JSRuntime;
using System;
using System.IO;
using System.Collections.Generic;

namespace MyApp;

public static class main {
  public static void mainFunction() {
    var lines = File.ReadAllLines("data.txt");
    Console.WriteLine($"Read {lines.Count} lines");

    var nums = new List<double> { 1.0, 2.0, 3.0 };
    nums.push(4.0);  // Extension method with JS semantics
    Console.WriteLine(nums.join(", "));  // Extension method with JS semantics
  }
}
```

**Native Binary:**

```bash
$ tsonic build src/main.ts
$ ./myapp
Read 10 lines
1, 2, 3, 4
```

---

## 2. Architectural Principles

### 2.1 .NET-First, Not JavaScript Porting

Tsonic uses **native .NET types** directly rather than creating wrapper classes:

**Array Handling:**

```typescript
// TypeScript:
const arr: number[] = [1, 2, 3];
arr.push(4);

// C# with mode: "dotnet" (default):
var arr = new List<double> { 1.0, 2.0, 3.0 };
arr.Add(4.0);  // push() → Add() (BCL method)

// C# with mode: "js":
using Tsonic.JSRuntime;
var arr = new List<double> { 1.0, 2.0, 3.0 };
arr.push(4.0);  // Extension method with JS semantics

// NOT creating a custom Array<T> class in either mode
```

**Benefits:**

- Full .NET ecosystem compatibility
- Better performance (no wrapper overhead)
- Interop with existing .NET libraries
- NativeAOT-friendly (no reflection needed)

### 2.2 ESM-Only Module System

**Strict Rules:**

- Local imports **MUST** have `.ts` extension
- .NET imports use capital letter namespaces (no extensions)
- No default exports
- No CommonJS interop

```typescript
// ✅ CORRECT
import { User } from "./models/User.ts";
import { File } from "System.IO";

// ❌ ERROR TSN1001 - Missing .ts
import { User } from "./models/User";

// ❌ ERROR TSN3002 - Default exports not supported
export default class User {}
```

**Rationale:**

- Explicit is better than implicit
- No magic resolution algorithms
- Clear distinction between local and .NET imports
- Easier to generate correct C# using statements

### 2.3 Functional Programming

**Mandatory Rules:**

- **No mutable variables** - Only `const`, never `let` or `var`
- **No mutations** - Never modify objects/arrays in place
- **Pure functions** - No side effects except necessary I/O
- **Immutable data structures** - All IR types are readonly
- **Explicit dependencies** - All inputs passed as parameters

```typescript
// ✅ CORRECT - Pure function, immutable update
const addImport = (module: IrModule, imp: IrImport): IrModule => ({
  ...module,
  imports: [...module.imports, imp],
});

// ❌ WRONG - Mutation
function addImport(module: IrModule, imp: IrImport): void {
  module.imports.push(imp); // MUTATION!
}
```

**Benefits:**

- Predictable, testable code
- Safe for parallelization (future)
- No hidden state or side effects
- Easier to reason about transformations

### 2.4 Explicit Over Implicit

**Error Instead of Guess:**

```typescript
// ❌ Do NOT guess or infer behavior
// ✅ Report clear error with diagnostic code

// Example: Missing .ts extension
// BAD:  Silently add .ts and continue
// GOOD: TSN1001 error with fix suggestion
```

**Clear Diagnostics:**

```
src/main.ts:5:8 - error TSN1001: Local import must have .ts extension

  5   import { User } from "./models/User";
               ~~~~~~~~~~~~~~~~~~~~~~~~~~~

Change to: "./models/User.ts"
```

### 2.5 Mode Configuration

**Configuration in tsonic.json:**

```json
{
  "mode": "dotnet", // "dotnet" (default) or "js"
  "rootNamespace": "MyApp"
  // ... other config
}
```

**Mode affects only built-in types** (Array, String, Math, console). All other .NET interop uses normal binding-based lowering regardless of mode.

**.NET Mode (`mode: "dotnet"`) - Default:**

- Default mode - no extra dependencies required
- Built-in methods use .NET BCL semantics
- `[1,2,3].sort()` → `list.Sort()` (BCL method)
- `"hello".toUpperCase()` → `"hello".ToUpper()` (BCL method)
- Best for .NET-native applications

**JavaScript Mode (`mode: "js"`):**

- Opt-in for JavaScript semantics on built-in types
- Requires `Tsonic.JSRuntime` NuGet package
- Built-in methods use extension methods with JS semantics
- `[1,2,3].sort()` → `list.sort()` (extension method with JS string coercion)
- Exact JavaScript semantics (sparse arrays, type coercion)
- Generated code includes `using Tsonic.JSRuntime;`

**Built-in Types Affected by Mode:**

| Type | Built-in Methods |
|------|------------------|
| Array | `sort`, `map`, `filter`, `reduce`, `push`, `pop`, `slice`, etc. |
| String | `toUpperCase`, `toLowerCase`, `slice`, `indexOf`, etc. |
| Math | `floor`, `ceil`, `round`, `abs`, `min`, `max`, etc. |
| console | `log`, `warn`, `error`, `info`, etc. |

**Key Distinction:**

- Mode detection is **hardcoded in the compiler** (not from bindings)
- Extension methods from bindings (LINQ, etc.) work the same in both modes
- See [Configuration - Mode Semantics](../configuration.md#mode-semantics) for details

### 2.6 Layered Architecture

**Clean Phase Separation:**

```
Frontend  → IR       (No C# knowledge)
Emitter   → C# Code  (No TypeScript knowledge)
Backend   → Binary   (No compiler knowledge)
```

Each layer has clear input/output contracts and no knowledge of adjacent layers.

---

## 3. Compilation Pipeline

### 3.1 Pipeline Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TSONIC COMPILER PIPELINE                 │
└─────────────────────────────────────────────────────────────┘

  TypeScript Source Files (.ts)
            │
            ▼
  ┌─────────────────────┐
  │  Phase 1: Program   │  TypeScript Compiler API
  ├─────────────────────┤
  │ • Create TS Program │  Packages: @tsonic/frontend
  │ • Load type checker │  Location:  packages/frontend/src/program/
  │ • Load .d.ts files  │
  │ • Load metadata     │  Data: TsonicProgram
  │ • Load bindings     │        DotnetMetadataRegistry
  └──────────┬──────────┘        BindingRegistry
             │
             ▼
  ┌─────────────────────┐
  │  Phase 2: Resolver  │  Module & Import Resolution
  ├─────────────────────┤
  │ • Resolve imports   │  Packages: @tsonic/frontend
  │ • ESM validation    │  Location:  packages/frontend/src/resolver/
  │ • Namespace mapping │
  │ • Build module graph│  Data: ModuleGraph
  └──────────┬──────────┘        ResolvedModule[]
             │
             ▼
  ┌─────────────────────┐
  │ Phase 3: Validation │  ESM & Feature Validation
  ├─────────────────────┤
  │ • Import rules      │  Packages: @tsonic/frontend
  │ • Export rules      │  Location:  packages/frontend/src/validation/
  │ • Feature support   │
  │ • Generic constraints│ Data: Diagnostic[]
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ Phase 4: IR Builder │  TypeScript AST → IR
  ├─────────────────────┤
  │ • Type conversion   │  Packages: @tsonic/frontend
  │ • Expr conversion   │  Location:  packages/frontend/src/ir/
  │ • Stmt conversion   │
  │ • Symbol extraction │  Data: IrModule
  └──────────┬──────────┘        IrType, IrExpression, IrStatement
             │
             ▼
  ┌─────────────────────┐
  │ Phase 5: Analysis   │  Dependency Analysis
  ├─────────────────────┤
  │ • Dependency graph  │  Packages: @tsonic/frontend
  │ • Circular detection│  Location:  packages/frontend/src/graph/
  │ • Build ordering    │
  │ • Symbol table      │  Data: DependencyAnalysis
  └──────────┬──────────┘        SymbolTable
             │
             ▼
  ┌─────────────────────┐
  │ Phase 6: Emitter    │  IR → C# Code Generation
  ├─────────────────────┤
  │ • Type emission     │  Packages: @tsonic/emitter
  │ • Expr emission     │  Location:  packages/emitter/src/
  │ • Stmt emission     │
  │ • Specialization    │  Data: EmittedModule
  │ • Adapter generation│        string (C# code)
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ Phase 7: Backend    │  .NET Compilation
  ├─────────────────────┤
  │ • .csproj generation│  Packages: @tsonic/backend
  │ • Program.cs gen    │  Location:  packages/backend/src/
  │ • dotnet publish    │
  │ • NativeAOT build   │  Data: BuildResult
  └──────────┬──────────┘        (binary path)
             │
             ▼
  ┌─────────────────────┐
  │ Phase 8: Runtime    │  Runtime Support (separate package)
  ├─────────────────────┤
  │ • Array helpers     │  Package: Tsonic.Runtime (C#)
  │ • String helpers    │  Location: (separate repo)
  │ • Math functions    │
  │ • console, JSON     │  Data: Runtime APIs
  └─────────────────────┘        (compiled into binary)
             │
             ▼
    Native Executable Binary
    (self-contained, no dependencies)
```

### 3.2 Phase Inputs and Outputs

| Phase          | Input                          | Output                        | Error Type                         |
| -------------- | ------------------------------ | ----------------------------- | ---------------------------------- |
| **Program**    | File paths, tsconfig           | TsonicProgram                 | Parse errors, metadata load errors |
| **Resolver**   | TsonicProgram, entry file      | ModuleGraph, ResolvedModule[] | TSN1xxx (import errors)            |
| **Validation** | ModuleGraph, source files      | Diagnostic[]                  | TSN1xxx-TSN3xxx                    |
| **IR Builder** | Validated modules              | IrModule[]                    | TSN4xxx (conversion errors)        |
| **Analysis**   | IrModule[]                     | DependencyAnalysis            | TSN3006 (circular deps)            |
| **Emitter**    | IrModule[], DependencyAnalysis | C# source files               | TSN4xxx (emission errors)          |
| **Backend**    | C# files, build config         | Native binary                 | TSN5xxx (build errors)             |

### 3.3 Data Flow

**Forward Flow (Success Path):**

```
TypeScript Files
  → TsonicProgram (with type checker, metadata, bindings)
  → ModuleGraph (with resolved imports)
  → Validated Modules (ESM compliant)
  → IrModule[] (intermediate representation)
  → DependencyAnalysis (with build order, symbol table)
  → C# Files (generated code)
  → Native Binary (compiled executable)
```

**Error Propagation:**

```
Any Phase
  → Diagnostic[] (with code, severity, message, location)
  → CLI Error Display
  → Exit with error code
```

---

## 4. State Management

### 4.1 No Global Mutable State

**Rule:** All phases are pure functions with explicit inputs and outputs.

```typescript
// ✅ CORRECT - Pure function signature
type Phase<Input, Output> = (
  input: Input,
  config: Config
) => Result<Output, Diagnostic[]>;

// Example:
const buildIr = (
  program: TsonicProgram,
  moduleGraph: ModuleGraph,
  options: BuildOptions
): Result<IrModule[], Diagnostic[]> => {
  // Pure transformation
};
```

**No Hidden State:**

```typescript
// ❌ WRONG - Global state
let currentModule: IrModule;
let diagnostics: Diagnostic[] = [];

function buildIr(program: TsonicProgram): IrModule[] {
  // Uses and modifies global state
}

// ✅ CORRECT - Explicit state
const buildIr = (
  program: TsonicProgram,
  options: BuildOptions
): Result<IrModule[], Diagnostic[]> => {
  // All state passed explicitly
};
```

### 4.2 Immutable Data Structures

**All IR types are readonly:**

```typescript
type IrModule = {
  readonly kind: "module";
  readonly filePath: string;
  readonly namespace: string;
  readonly className: string;
  readonly imports: readonly IrImport[];
  readonly body: readonly IrStatement[];
  readonly exports: readonly IrExport[];
};
```

**Transformations create new objects:**

```typescript
// ✅ CORRECT
const addImport = (module: IrModule, imp: IrImport): IrModule => ({
  ...module,
  imports: [...module.imports, imp],
});

// Returns NEW module with updated imports array
```

### 4.3 Result Types

**Explicit error handling with Result<T, E>:**

```typescript
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// Example usage:
const buildIr = (
  program: TsonicProgram,
  options: BuildOptions
): Result<IrModule[], Diagnostic[]> => {
  if (hasErrors) {
    return { ok: false, error: diagnostics };
  }
  return { ok: true, value: irModules };
};
```

**No exceptions for control flow:**

```typescript
// ❌ WRONG
function buildIr(program: TsonicProgram): IrModule[] {
  if (hasErrors) {
    throw new Error("Build failed"); // Don't throw
  }
  return modules;
}

// ✅ CORRECT
const buildIr = (program: TsonicProgram): Result<IrModule[], Diagnostic[]> => {
  // Return Result type
};
```

---

## 5. Package Organization

### 5.1 Monorepo Structure

```
@tsonic/monorepo
├── packages/
│   ├── frontend/    # Phases 1-5: TS → IR
│   ├── emitter/     # Phase 6: IR → C#
│   ├── backend/     # Phase 7: C# → Binary
│   └── cli/         # Phase 8: CLI orchestration
├── scripts/
│   ├── build.sh     # Build all packages
│   ├── clean.sh     # Clean build artifacts
│   ├── test.sh      # Run all tests
│   ├── format-all.sh
│   └── lint-all.sh
└── package.json     # Root package.json
```

### 5.2 Package Responsibilities

**@tsonic/frontend** (4,618 LOC, 110 files)

- TypeScript program creation (Phase 1)
- Module resolution (Phase 2)
- Validation (Phase 3)
- IR building (Phase 4)
- Dependency analysis (Phase 5)

**@tsonic/emitter** (3,146 LOC)

- C# type emission
- C# expression emission
- C# statement emission
- Generic specialization (monomorphization)
- Structural constraint adapter generation

**@tsonic/backend**

- .csproj file generation
- Program.cs generation
- dotnet CLI wrapper
- NativeAOT build orchestration

**@tsonic/cli**

- Command-line interface
- Configuration loading (tsonic.json)
- Pipeline orchestration
- Diagnostic formatting
- Progress reporting

### 5.3 Package Dependencies

```
Dependency Chain:
cli → backend → emitter → frontend

External Dependencies:
- typescript@5.9.2 (frontend)
- chalk (cli - terminal colors)
- commander (cli - argument parsing)
```

**Import Rules:**

- Packages can only import from dependencies (not siblings)
- `cli` can import from all packages
- `backend` can import from `emitter` and `frontend`
- `emitter` can import from `frontend` only
- `frontend` has no internal dependencies (except TypeScript)

---

## 6. Key Data Structures

### 6.1 IR Module

**IrModule** - Root representation of a TypeScript file:

```typescript
type IrModule = {
  readonly kind: "module";
  readonly filePath: string; // /src/models/User.ts
  readonly namespace: string; // MyApp.models
  readonly className: string; // User
  readonly isStaticContainer: boolean; // true if no class, only exports
  readonly imports: readonly IrImport[];
  readonly body: readonly IrStatement[];
  readonly exports: readonly IrExport[];
};
```

**Static Container Detection:**

```typescript
// File: utils.ts (no class named "utils")
export function helper() {}
export const constant = 42;

// isStaticContainer = true
// Emits: public static class utils { ... }
```

### 6.2 IR Type System

```typescript
type IrType =
  | IrPrimitiveType // string, number, boolean, null, undefined
  | IrReferenceType // User, Array<T>, Map<K,V>
  | IrArrayType // T[]
  | IrFunctionType // (a: T) => U
  | IrObjectType // { x: number; y: string }
  | IrUnionType // T | U
  | IrIntersectionType // T & U
  | IrLiteralType // "literal" | 42 | true
  | IrAnyType // any
  | IrUnknownType // unknown
  | IrVoidType // void
  | IrNeverType; // never
```

### 6.3 IR Expressions

**35 expression types:**

```typescript
type IrExpression =
  | IrLiteralExpression // 42, "hello", true
  | IrIdentifierExpression // variable (with CLR binding)
  | IrArrayExpression // [1, 2, 3]
  | IrObjectExpression // { x: 1, y: 2 }
  | IrFunctionExpression // function() {}
  | IrArrowFunctionExpression // () => {}
  | IrMemberExpression // obj.prop (with member binding)
  | IrCallExpression // fn(args) (with type arguments)
  | IrNewExpression // new Class()
  | IrThisExpression // this
  | IrUpdateExpression // ++x, x--
  | IrUnaryExpression // !x, -x, typeof x
  | IrBinaryExpression // x + y, x === y
  | IrLogicalExpression // x && y, x || y
  | IrConditionalExpression // x ? y : z
  | IrAssignmentExpression // x = y, x += y
  | IrTemplateLiteralExpression // `hello ${name}`
  | IrSpreadExpression // ...arr
  | IrAwaitExpression // await promise
  | IrYieldExpression; // yield value
```

**Key Feature: Binding Resolution**

```typescript
type IrIdentifierExpression = {
  readonly kind: "identifier";
  readonly name: string;
  readonly inferredType?: IrType;
  readonly resolvedClrType?: string; // "Tsonic.Runtime.console"
  readonly resolvedAssembly?: string; // "Tsonic.Runtime"
  readonly csharpName?: string; // Optional C# rename
};

type IrMemberExpression = {
  readonly kind: "memberAccess";
  readonly object: IrExpression;
  readonly property: IrExpression | string;
  readonly memberBinding?: {
    readonly assembly: string; // "System.Linq"
    readonly type: string; // "System.Linq.Enumerable"
    readonly member: string; // "SelectMany"
  };
};
```

### 6.4 IR Statements

**18 statement types:**

```typescript
type IrStatement =
  | IrVariableDeclaration      // const x = 1
  | IrFunctionDeclaration      // function fn() {}
  | IrClassDeclaration         // class C {}
  | IrInterfaceDeclaration     // interface I {}
  | IrEnumDeclaration          // enum E {}
  | IrTypeAliasDeclaration     // type T = ...
  | IrExpressionStatement      // expr;
  | IrReturnStatement          // return expr;
  | IrIfStatement              // if (cond) {}
  | IrWhileStatement           // while (cond) {}
  | IrForStatement             // for (;;) {}
  | IrForOfStatement           // for (x of arr) {}
  | IrSwitchStatement          // switch (x) {}
  | IrThrowStatement           // throw err;
  | IrTryStatement             // try {} catch {}
  | IrBlockStatement           // { stmts }
  | IrBreakStatement;          // break
  | IrContinueStatement;       // continue
```

### 6.5 Class Members

```typescript
type IrClassDeclaration = {
  readonly kind: "classDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly superClass?: IrExpression;
  readonly implements: readonly IrType[];
  readonly members: readonly IrClassMember[];
  readonly isExported: boolean;
};

type IrClassMember =
  | IrConstructorDeclaration
  | IrMethodDeclaration
  | IrPropertyDeclaration;

type IrMethodDeclaration = {
  readonly kind: "methodDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
  readonly body?: IrBlockStatement;
  readonly isStatic: boolean;
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
  readonly accessibility: "public" | "private" | "protected";
  readonly isOverride?: boolean; // Determined from metadata
  readonly isShadow?: boolean; // Determined from metadata
};
```

---

## 7. Type System Mappings

### 7.1 Primitives

```
TypeScript        C#
─────────────────────────────
string         →  string
number         →  double
boolean        →  bool
null           →  null
undefined      →  null (nullable context)
any            →  object
unknown        →  object
void           →  void
never          →  (error - not supported)
bigint         →  System.Numerics.BigInteger
symbol         →  (error - not supported)
```

### 7.2 Arrays

```
TypeScript              C#
─────────────────────────────────────────────
T[]                  →  List<T>
ReadonlyArray<T>     →  IReadOnlyList<T>
[T, U]               →  (T, U) tuple
```

**Array Method Handling by Runtime Mode:**

```typescript
// TypeScript:
const arr = [1, 2, 3];
arr.push(4);
const result = arr.map(x => x * 2);

// C# with mode: "dotnet" (default):
var arr = new List<double> { 1.0, 2.0, 3.0 };
arr.Add(4.0);  // push() → Add()
var result = arr.Select(x => x * 2.0).ToList();  // map() → Select().ToList()

// C# with mode: "js":
using Tsonic.JSRuntime;
var arr = new List<double> { 1.0, 2.0, 3.0 };
arr.push(4.0);  // Extension method
var result = arr.map(x => x * 2.0);  // Extension method
```

### 7.3 Functions

```
TypeScript                C#
────────────────────────────────────────────
() => void             →  Action
() => T                →  Func<T>
(a: A) => void         →  Action<A>
(a: A) => T            →  Func<A, T>
(a: A, b: B) => T      →  Func<A, B, T>
```

### 7.4 Objects

```typescript
// TypeScript:
interface Point {
  x: number;
  y: number;
}

// C#:
public interface Point {
  double x { get; set; }
  double y { get; set; }
}
```

### 7.5 Generics

```typescript
// TypeScript:
class Box<T> {
  value: T;
}

// C#:
public class Box<T> {
  public T value;
}
```

---

## 8. Module System

### 8.1 ESM Import Rules

**Local Imports (starts with `.` or `/`):**

```typescript
import { User } from "./models/User.ts"; // ✅
import { User } from "./models/User"; // ❌ TSN1001
```

**.NET Imports (starts with capital letter):**

```typescript
import { File } from "System.IO"; // ✅
import { Console } from "System"; // ✅
import { File } from "System/IO"; // ❌ TSN1004
```

**Module Bindings (from binding registry):**

```typescript
// If binding manifest defines "fs" → "Tsonic.NodeApi.fs"
import * as fs from "fs"; // ✅
```

### 8.2 Namespace Generation

**Directory Structure → Namespace:**

```
Project root:  /home/user/project
Source root:   /home/user/project/src
Root namespace: MyApp

File:      /home/user/project/src/models/User.ts
Namespace: MyApp.models
Class:     User
```

**Case Preservation:**

```
src/MyModels/User.ts       → namespace MyApp.MyModels; class User
src/models/user-dto.ts     → namespace MyApp.models; class user-dto
```

### 8.3 Import Resolution Algorithm

```typescript
const resolveImport = (
  specifier: string,
  containingFile: string,
  sourceRoot: string,
  bindings: BindingRegistry
): Result<ResolvedModule, Diagnostic> => {
  // 1. Check if local (. or /)
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    // Must have .ts extension
    if (!specifier.endsWith(".ts")) {
      return error(TSN1001("Missing .ts extension"));
    }

    // Resolve relative to containing file
    const resolved = path.resolve(path.dirname(containingFile), specifier);

    // Check file exists
    if (!fs.existsSync(resolved)) {
      return error(TSN1004("Module not found"));
    }

    return ok({
      resolvedPath: resolved,
      isLocal: true,
      isDotNet: false,
    });
  }

  // 2. Check if .NET namespace (starts with capital)
  if (/^[A-Z]/.test(specifier)) {
    // Validate namespace format
    if (!/^[A-Z][a-zA-Z0-9.]*$/.test(specifier)) {
      return error(TSN1004("Invalid namespace format"));
    }

    return ok({
      resolvedPath: specifier, // Namespace, not path
      isLocal: false,
      isDotNet: true,
    });
  }

  // 3. Check binding registry
  const binding = bindings.getBinding(specifier);
  if (binding) {
    return ok({
      resolvedPath: binding.type,
      isLocal: false,
      isDotNet: false,
      resolvedClrType: binding.type,
      resolvedAssembly: binding.assembly,
    });
  }

  return error(TSN1004("Unknown module"));
};
```

---

## 9. Code Generation Strategy

### 9.1 Generic Specialization (Monomorphization)

**Problem:** C# generics have runtime overhead in NativeAOT.

**Solution:** Generate specialized versions for each concrete type usage.

```typescript
// TypeScript:
function identity<T>(x: T): T {
  return x;
}

const a = identity<number>(42);
const b = identity<string>("hello");

// Generated C#:
public static double identity_Double(double x) {
  return x;
}

public static string identity_String(string x) {
  return x;
}

// Call sites:
var a = identity_Double(42.0);
var b = identity_String("hello");
```

**Benefits:**

- No boxing/unboxing
- Better inlining
- Smaller binary size (AOT can trim unused specializations)

### 9.2 Structural Constraint Adapters

**Problem:** TypeScript has structural typing, C# has nominal typing.

**Solution:** Generate interface + wrapper for structural constraints.

```typescript
// TypeScript:
function getId<T extends { id: number }>(obj: T): number {
  return obj.id;
}

// Generated C#:
public interface __Constraint_T {
  double id { get; }
}

public sealed class __Wrapper_T : __Constraint_T {
  private readonly object _inner;
  public double id => ((dynamic)_inner).id;
  public __Wrapper_T(object inner) => _inner = inner;
}

public static double getId<T>(__Constraint_T obj) where T : __Constraint_T {
  return obj.id;
}
```

### 9.3 Array Implementation

**Native List<T> with Static Helpers:**

```typescript
// TypeScript:
const arr = [1, 2, 3];
arr.push(4);
arr.pop();
const doubled = arr.map(x => x * 2);

// C#:
var arr = new List<double> { 1.0, 2.0, 3.0 };
Tsonic.Runtime.Array.push(arr, 4.0);
Tsonic.Runtime.Array.pop(arr);
var doubled = Tsonic.Runtime.Array.map(arr, x => x * 2.0);
```

**Why Not Custom Array<T> Class?**

- Native List<T> is faster
- Better .NET interop
- NativeAOT-friendly
- Can pass to .NET APIs directly

---

## 10. Error Handling

### 10.1 Diagnostic Codes

**TSN1xxx - Import/Module Errors:**

- TSN1001: Missing .ts extension on local import
- TSN1003: Case mismatch in file path
- TSN1004: Module not found
- TSN1006: Circular dependency detected

**TSN2xxx - Type System Errors:**

- TSN2001: JavaScript method used in dotnet runtime mode
- TSN2002: Conditional types not supported
- TSN2003: File name conflicts with export

**TSN3xxx - Feature Errors:**

- TSN3001: Export-all not supported
- TSN3002: Default exports not supported
- TSN3003: Dynamic imports not supported

**TSN4xxx - Code Generation Errors:**

- Reserved for emitter-phase errors

**TSN5xxx - Build Errors:**

- Reserved for backend/NativeAOT errors

### 10.2 Diagnostic Format

```typescript
type Diagnostic = {
  readonly code: string; // e.g., "TSN1001"
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly hint?: string; // Suggested fix
};
```

---

## 11. Performance Characteristics

### 11.1 Compilation Performance

**Small Project (10 files, ~1000 LOC):**

- Parse: ~50ms
- IR Build: ~30ms
- Emit: ~20ms
- Total (without dotnet): ~100ms

**Medium Project (100 files, ~10,000 LOC):**

- Parse: ~500ms
- IR Build: ~300ms
- Emit: ~200ms
- Total (without dotnet): ~1s

**NativeAOT Compilation:**

- Dominates total time (10-60 seconds)
- Depends on project size and optimization level

### 11.2 Runtime Performance

**Array Operations:**

- List<T> with static helpers: ~5-10% slower than raw List<T>
- Still 10-100x faster than JavaScript engines

**Function Calls:**

- Specialized generics: Zero overhead (inlined)
- Non-specialized: Normal C# generic overhead

**Binary Size:**

- Minimal: ~3-5 MB (hello world)
- Medium: ~10-20 MB (typical app)
- Includes trimmed .NET runtime + app code

---

## 12. Limitations

### 12.1 TypeScript Features Not Supported

- Decorators
- Namespaces (ambient only)
- Method overloading (use generics instead)
- `#private` fields (use `private` keyword)
- Mixins
- Module augmentation

### 12.2 Runtime Limitations

- No `eval()` or `Function()` constructor
- Limited reflection (NativeAOT limitation)
- No prototype manipulation
- No `with` statements

### 12.3 .NET Interop Limitations

- Requires .NET 10.0+
- NativeAOT only (no dynamic loading)
- No COM interop
- Limited async/await (Task-based only)

---

## 13. File Locations

### 13.1 Frontend Package

```
packages/frontend/src/
├── index.ts                       # Public API
├── program/                       # Phase 1
│   ├── creation.ts
│   ├── config.ts
│   ├── metadata.ts
│   └── bindings.ts
├── resolver/                      # Phase 2
│   ├── import-resolution.ts
│   ├── path-resolution.ts
│   └── naming.ts
├── validation/                    # Phase 3
│   ├── orchestrator.ts
│   ├── imports.ts
│   └── exports.ts
├── ir/                           # Phase 4
│   ├── types/                    # IR type definitions
│   ├── builder/                  # IR construction
│   ├── converters/               # AST → IR
│   │   ├── expressions/
│   │   └── statements/
│   └── type-converter/
└── graph/                        # Phase 5
    ├── builder.ts
    ├── extraction/
    └── circular.ts
```

### 13.2 Emitter Package

```
packages/emitter/src/
├── index.ts                      # Public API
├── emitter.ts                    # Main entry point
├── core/                         # Core emission
│   ├── module-emitter/
│   ├── imports.ts
│   └── exports.ts
├── types/                        # Type emission
├── expressions/                  # Expression emission
├── statements/                   # Statement emission
│   ├── declarations/
│   ├── classes/
│   └── control/
└── specialization/               # Monomorphization
    ├── collection/
    ├── generation.ts
    └── substitution.ts
```

### 13.3 Backend Package

```
packages/backend/src/
├── index.ts                      # Public API
├── build-orchestrator.ts         # Main build logic
├── project-generator.ts          # .csproj generation
├── program-generator.ts          # Program.cs generation
└── dotnet.ts                     # dotnet CLI wrapper
```

---

## 14. Dependencies

### 14.1 Required Dependencies

**@tsonic/types** (npm package):

- **Status**: REQUIRED for compilation
- **Purpose**: Provides branded numeric types (`int`, `float`, `long`, etc.)
- **Installation**: `npm install @tsonic/types`
- **Usage**: Automatically loaded during compilation

### 14.2 Optional Dependencies

**Tsonic.JSRuntime** (.NET package):

- **Status**: OPTIONAL (required only when `mode: "js"`)
- **Purpose**: Provides JavaScript semantics via extension methods on .NET types
- **Installation**: Automatically added to .csproj when `mode: "js"`
- **Size Impact**: ~500KB additional to binary size

**@types/dotnet** (npm package):

- **Status**: REQUIRED (for .NET BCL type declarations)
- **Generated by**: tsbindgen
- **Purpose**: TypeScript declarations for .NET types
- **Configuration**: Specified in tsconfig.json `typeRoots`

### 14.3 Bindings and Metadata

**bindings.json**:

- **Source**: Generated by tsbindgen alongside type declarations
- **Purpose**: Maps TypeScript names to C# names (handles casing)
- **Location**: Within each namespace directory of type declarations
- **Usage**: Loaded during compilation for name resolution

## 15. See Also

- [01-pipeline-flow.md](01-pipeline-flow.md) - Detailed phase connections
- [02-phase-program.md](02-phase-program.md) - Program creation phase
- [03-phase-resolver.md](03-phase-resolver.md) - Module resolution phase
- [04-phase-validation.md](04-phase-validation.md) - Validation phase
- [05-phase-ir-builder.md](05-phase-ir-builder.md) - IR building phase
- [06-phase-analysis.md](06-phase-analysis.md) - Dependency analysis phase
- [07-phase-emitter.md](07-phase-emitter.md) - C# emission phase
- [08-phase-backend.md](08-phase-backend.md) - NativeAOT build phase
- [09-phase-runtime.md](09-phase-runtime.md) - Runtime implementation

---

**Document Statistics:**

- Lines: ~1,150
- Sections: 14 major sections
- Code Examples: 50+
- Coverage: Complete system overview, architectural principles, all phases, data structures, algorithms
