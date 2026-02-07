# .NET Interop

How to use .NET libraries and APIs in Tsonic.

## Overview

Tsonic provides full access to .NET Base Class Library (BCL) and third-party NuGet packages through TypeScript type declarations.

## Import Syntax

### BCL Imports

Import .NET types using the `@tsonic/dotnet` package:

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { File, Path } from "@tsonic/dotnet/System.IO.js";
import { List, Dictionary } from "@tsonic/dotnet/System.Collections.Generic.js";
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";
```

### Import Pattern

```
@tsonic/dotnet/<Namespace>.js
```

Maps directly to .NET namespaces:

| Import                                      | .NET Namespace               |
| ------------------------------------------- | ---------------------------- |
| `@tsonic/dotnet/System.js`                     | `System`                     |
| `@tsonic/dotnet/System.IO.js`                  | `System.IO`                  |
| `@tsonic/dotnet/System.Collections.Generic.js` | `System.Collections.Generic` |

### Other CLR Packages

Tsonic can also consume **tsbindgen-generated** bindings packages besides the BCL.

Two common examples:

- `@tsonic/nodejs` — Node.js-style APIs implemented in .NET.
- `@tsonic/js` — JavaScript runtime APIs (JS semantics implemented in C#).

These are regular CLR bindings: you install them and import them like any other package.

## Overriding .NET Virtual Methods (including overload families)

.NET libraries frequently expose **protected virtual** members that you’re expected to override
(e.g. `DbContext.OnModelCreating`, `Stream.Dispose(bool)`, etc.). Some of these are **overload
families** (same CLR name, multiple signatures).

In Tsonic you author these using standard TypeScript overload syntax:

1. Write one overload signature per CLR signature you want to support/override
2. Provide exactly one implementation body
3. Use `istype<T>(pN)` (from `@tsonic/core/lang.js`) to let the compiler specialize the single body
   into one CLR method per signature

`istype<T>(...)` is **compile-time only** — the compiler must erase it before emitting C#.

Example (single-parameter overload family):

```ts
import { istype } from "@tsonic/core/lang.js";

class Overloads {
  Foo(x: string): string;
  Foo(x: boolean): string;
  Foo(p0: unknown): unknown {
    if (istype<string>(p0)) return `s:${p0}`;
    if (istype<boolean>(p0)) return p0 ? "t" : "f";
    throw new Error("unreachable");
  }
}
```

Notes:

- Use `unknown` for the implementation signature’s parameters/return type.
- `istype<T>(...)` must be called with a simple parameter identifier (`p0`, `p1`, …).
- If `istype<T>(...)` reaches emission, Tsonic hard-errors with `TSN7441`.
- For CLR overrides, **avoid TypeScript visibility modifiers** (`public`/`protected`/`private`) on the
  implementation. Bindings don’t encode CLR visibility in the `$instance` surface, so writing
  `protected override ...` can fail vanilla `tsc` even though the override is valid in CLR.
  Prefer `override Method(...) { ... }` and let Tsonic emit the correct CLR accessibility from bindings.

## Authoring CLR Bindings Packages (tsbindgen)

Tsonic detects CLR namespace imports by discovering `bindings.json` files (tsbindgen format).
This works for any package — not just `@tsonic/*`.

### Keep Generated Bindings Under `dist/` (Recommended)

For your own bindings packages (including npm workspaces), keep generated files out of git by
writing them under `dist/` and exporting them via npm `exports`.

Directory layout (example):

```txt
packages/domain/
  src/...
  dist/tsonic/bindings/
    System.Linq.js
    System.Linq.d.ts
    System.Linq/
      bindings.json
      internal/index.d.ts
```

`packages/domain/.gitignore`:

```txt
dist/
```

`packages/domain/package.json` (exports map ergonomic imports to `dist/`):

```json
{
  "name": "@acme/domain",
  "private": true,
  "type": "module",
  "exports": {
    "./package.json": "./package.json",
    "./*.js": {
      "types": "./dist/tsonic/bindings/*.d.ts",
      "default": "./dist/tsonic/bindings/*.js"
    }
  }
}
```

Then consumers can import namespaces normally:

```ts
import { Enumerable } from "@acme/domain/System.Linq.js";
```

Tsonic resolves the import using npm’s module resolution (including `exports`) and then locates
the nearest `bindings.json` for CLR metadata discovery.

## Common APIs

### Console

```typescript
import { Console } from "@tsonic/dotnet/System.js";

Console.WriteLine("Hello!");
Console.Write("No newline");
const input = Console.ReadLine();
Console.Error.WriteLine("Error message");
```

### File I/O

```typescript
import { File, Path, Directory } from "@tsonic/dotnet/System.IO.js";

// Read files
const text = File.ReadAllText("./data.txt");
const lines = File.ReadAllLines("./data.txt");
const bytes = File.ReadAllBytes("./image.png");

// Write files
File.WriteAllText("./output.txt", "content");
File.WriteAllLines("./output.txt", ["line1", "line2"]);
File.WriteAllBytes("./output.bin", bytes);

// Check existence
if (File.Exists("./data.txt")) {
  // ...
}

// Paths
const full = Path.Combine(".", "data", "file.txt");
const dir = Path.GetDirectoryName(full);
const ext = Path.GetExtension(full);

// Directories
Directory.CreateDirectory("./output");
const files = Directory.GetFiles("./data");
```

### Collections

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import {
  List,
  Dictionary,
  HashSet,
} from "@tsonic/dotnet/System.Collections.Generic.js";

// List<T>
const list = new List<number>();
list.Add(1);
list.Add(2);
list.AddRange([3, 4, 5]);
Console.WriteLine(list.Count);
const first = list[0];

// Dictionary<K,V>
const dict = new Dictionary<string, number>();
dict.Add("one", 1);
dict["two"] = 2;
if (dict.ContainsKey("one")) {
  Console.WriteLine(dict["one"]);
}

// HashSet<T>
const set = new HashSet<string>();
set.Add("a");
set.Add("b");
Console.WriteLine(set.Contains("a"));
```

### LINQ

```typescript
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";

const numbers = [1, 2, 3, 4, 5];

// Query operations
const doubled = Enumerable.Select(numbers, (n) => n * 2);
const filtered = Enumerable.Where(numbers, (n) => n > 2);
const sum = Enumerable.Sum(numbers);
const first = Enumerable.First(numbers);
const any = Enumerable.Any(numbers, (n) => n > 10);
```

### JavaScript Runtime APIs (`@tsonic/js`)

Tsonic ships as a .NET compiler, but you can opt into JavaScript-style APIs by importing `@tsonic/js`
(bindings for `Tsonic.JSRuntime.dll`).

Setup:

```bash
# New project
tsonic init --js

# Existing project
tsonic add js
```

```typescript
import { console, JSON, Math, Date, Timers } from "@tsonic/js/index.js";

export function main(): void {
  console.log("Hello from JSRuntime!");

  const now = new Date();
  console.log(now.toISOString());

  const value = JSON.parse<{ x: number }>("{\"x\": 1}");
  console.log(JSON.stringify(value));

  console.log(Math.max(1, 2, 3));

  Timers.setTimeout(() => console.log("tick"), 250);
}
```

### Extension Methods (LINQ-style `xs.Where(...).Select(...)`)

tsbindgen-generated packages expose **type-only** `ExtensionMethods` helpers that model C# `using` semantics.

Bring a namespace’s extension methods into scope by wrapping the receiver type:

```typescript
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";

type LinqList<T> = Linq<List<T>>;

const numbers = new List<number>() as unknown as LinqList<number>;
numbers.Add(1);
numbers.Add(2);
numbers.Add(3);

const doubled = numbers.Where((x) => x % 2 === 0).Select((x) => x * 2).ToList();
```

The same pattern works for `IEnumerable<T>` and `IQueryable<T>` (for example when using EF Core):

```typescript
import type { ExtensionMethods as Linq, IQueryable } from "@tsonic/dotnet/System.Linq.js";

type LinqQuery<T> = Linq<IQueryable<T>>;
declare const query: LinqQuery<number>;

query.Where((x) => x > 0).Select((x) => x * 2);
```

Compose multiple extension namespaces by nesting:

```typescript
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";
import type { ExtensionMethods as Xml } from "@tsonic/dotnet/System.Xml.Linq.js";

type Ext<T> = Linq<Xml<T>>;
```

To write your own extension methods, see [Language Intrinsics](lang-intrinsics.md) (`thisarg<T>`).

### DateTime

```typescript
import { Console, DateTime, TimeSpan } from "@tsonic/dotnet/System.js";

const now = DateTime.Now;
const utc = DateTime.UtcNow;
const date = new DateTime(2024, 1, 15);

Console.WriteLine(now.Year);
Console.WriteLine(now.ToString("yyyy-MM-dd"));

const duration = TimeSpan.FromHours(2);
const later = now.Add(duration);
```

### JSON Serialization

```typescript
import { JsonSerializer } from "@tsonic/dotnet/System.Text.Json.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";

interface User {
  id: number;
  name: string;
}

// Serialize object to JSON
const user: User = { id: 1, name: "Alice" };
const json = JsonSerializer.Serialize(user);

// Deserialize JSON to object
const parsed = JsonSerializer.Deserialize<User>(json);

// Works with collections too
const users = new List<User>();
users.Add({ id: 1, name: "Alice" });
users.Add({ id: 2, name: "Bob" });
const usersJson = JsonSerializer.Serialize(users);
```

**NativeAOT Support**: Tsonic automatically generates the required `JsonSerializerContext`
for NativeAOT compatibility. No additional configuration needed.

### String Operations

```typescript
import { String } from "@tsonic/dotnet/System.js";

const result = String.IsNullOrEmpty(input);
const joined = String.Join(", ", ["a", "b", "c"]);
const formatted = String.Format("Hello, {0}!", name);
```

## Adding Dependencies (Workspace)

Dependencies are workspace-scoped and configured in `tsonic.workspace.json` (see [CLR Bindings & Workspaces](bindings.md)).

Use the CLI:

```bash
tsonic add nuget Newtonsoft.Json 13.0.3
tsonic add package ./path/to/MyLib.dll
tsonic add framework Microsoft.AspNetCore.App
tsonic restore
```

If you omit the optional `types` argument, Tsonic auto-generates bindings and mirrors them into `node_modules/<name>-types/`.

Example (auto-generated bindings for `Newtonsoft.Json`):

```typescript
import { JsonConvert } from "newtonsoft-json-types/Newtonsoft.Json.js";

const json = JsonConvert.SerializeObject({ name: "Alice" });
const obj = JsonConvert.DeserializeObject(json);
```

If you already have a published bindings package, pass it as `types` to `tsonic add ...` and import from that package instead.

## Type Mapping

### Primitive Types

| TypeScript | C#       |
| ---------- | -------- |
| `number`   | `double` |
| `string`   | `string` |
| `boolean`  | `bool`   |
| `int`      | `int`    |
| `float`    | `float`  |
| `long`     | `long`   |

### Collection Types

| TypeScript        | C#                                           |
| ----------------- | -------------------------------------------- |
| `T[]`             | Native array (`T[]`)                         |
| `Array<T>`        | Native array (`T[]`)                         |
| `List<T>`         | `System.Collections.Generic.List<T>`         |
| `Dictionary<K,V>` | `System.Collections.Generic.Dictionary<K,V>` |
| `HashSet<T>`      | `System.Collections.Generic.HashSet<T>`      |

### Special Types

| TypeScript   | C#        |
| ------------ | --------- |
| `void`       | `void`    |
| `null`       | `null`    |
| `undefined`  | `null`    |
| `Promise<T>` | `Task<T>` |

## Async/Await

.NET async methods map to TypeScript async:

```typescript
import { File } from "@tsonic/dotnet/System.IO.js";

export async function main(): Promise<void> {
  const content = await File.ReadAllTextAsync("./data.txt");
  await File.WriteAllTextAsync("./output.txt", content);
}
```

## Error Handling

.NET exceptions work with TypeScript try/catch:

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { File } from "@tsonic/dotnet/System.IO.js";

try {
  const content = File.ReadAllText("./missing.txt");
} catch (error) {
  Console.WriteLine("File not found");
}
```

## C# Attributes

Apply .NET attributes to classes using the marker-call API:

```typescript
import { attributes as A } from "@tsonic/core/attributes.js";

// Declare attribute types (from @tsonic/dotnet or custom)
declare class SerializableAttribute {}
declare class ObsoleteAttribute {
  constructor(message?: string);
}

// Apply attributes to classes
export class User {
  name!: string;
  age!: number;
}
A.on(User).type.add(SerializableAttribute);

// Attributes with constructor arguments
export class Config {
  setting!: string;
}
A.on(Config).type.add(ObsoleteAttribute, "Use NewConfig instead");

// Multiple attributes on same class
export class LegacyService {
  data!: string;
}
A.on(LegacyService).type.add(SerializableAttribute);
A.on(LegacyService).type.add(ObsoleteAttribute, "Deprecated");
```

Generates:

```csharp
[Serializable]
public class User
{
    public string name { get; set; }
    public double age { get; set; }
}

[Obsolete("Use NewConfig instead")]
public class Config
{
    public string setting { get; set; }
}

[Serializable]
[Obsolete("Deprecated")]
public class LegacyService
{
    public string data { get; set; }
}
```

## Parameter Modifiers

.NET methods with `out`, `ref`, or `in` parameters work automatically when using tsbindgen-generated bindings:

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import type { int } from "@tsonic/core/types.js";
import { defaultof, out } from "@tsonic/core/lang.js";

// Dictionary.TryGetValue has an 'out' parameter
import { Dictionary } from "@tsonic/dotnet/System.Collections.Generic.js";

const dict = new Dictionary<string, int>();
dict.Add("key", 42);

// The 'out' parameter is handled automatically
let value = defaultof<int>();
if (dict.TryGetValue("key", out(value))) {
  Console.WriteLine(value); // 42
}
```

Generated C#:

```csharp
int value;
if (dict.TryGetValue("key", out value))
{
    Console.WriteLine(value);
}
```

Parameter modifier types:

| Modifier | C# Keyword | Use Case                          |
| -------- | ---------- | --------------------------------- |
| `out`    | `out`      | Return additional values          |
| `ref`    | `ref`      | Pass by reference, may be mutated |
| `inref`  | `in`       | Pass by reference, read-only      |

Alternate call-site form (also supported):

```typescript
import type { int, out } from "@tsonic/core/types.js";

let value: int = 0;
dict.TryGetValue("key", value as out<int>);
```

## Nullable Value Type Narrowing

Tsonic automatically narrows nullable value types in conditional blocks:

```typescript
import { int } from "@tsonic/core/types.js";

function processValue(value: int | null): int {
  if (value !== null) {
    // value is narrowed to 'int' here
    return value * 2;
  }
  return 0;
}

// Compound conditions also work
function processMultiple(a: int | null, b: int | null): int {
  if (a !== null && b !== null) {
    // Both a and b are narrowed to 'int'
    return a + b;
  }
  return 0;
}
```

Generated C#:

```csharp
public static int processValue(int? value)
{
    if (value != null)
    {
        return value.Value * 2;  // .Value access for narrowed type
    }
    return 0;
}

public static int processMultiple(int? a, int? b)
{
    if (a != null && b != null)
    {
        return a.Value + b.Value;
    }
    return 0;
}
```

This handles C# nullable value types (`int?`, `double?`, etc.) which require `.Value` access after null checks.

## Best Practices

1. **Use type packages**: Install `@tsonic/dotnet` for type safety
2. **Explicit imports**: Import only what you need
3. **Check null**: .NET methods may return null
4. **Handle exceptions**: Wrap .NET calls in try/catch
5. **Prefer async**: Use async versions of I/O operations
