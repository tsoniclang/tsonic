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
      internal/metadata.json
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

Console.writeLine("Hello!");
Console.write("No newline");
const input = Console.readLine();
Console.error.writeLine("Error message");
```

### File I/O

```typescript
import { File, Path, Directory } from "@tsonic/dotnet/System.IO.js";

// Read files
const text = File.readAllText("./data.txt");
const lines = File.readAllLines("./data.txt");
const bytes = File.readAllBytes("./image.png");

// Write files
File.writeAllText("./output.txt", "content");
File.writeAllLines("./output.txt", ["line1", "line2"]);
File.writeAllBytes("./output.bin", bytes);

// Check existence
if (File.exists("./data.txt")) {
  // ...
}

// Paths
const full = Path.combine(".", "data", "file.txt");
const dir = Path.getDirectoryName(full);
const ext = Path.getExtension(full);

// Directories
Directory.createDirectory("./output");
const files = Directory.getFiles("./data");
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
list.add(1);
list.add(2);
list.addRange([3, 4, 5]);
Console.writeLine(list.count);
const first = list[0];

// Dictionary<K,V>
const dict = new Dictionary<string, number>();
dict.add("one", 1);
dict["two"] = 2;
if (dict.containsKey("one")) {
  Console.writeLine(dict["one"]);
}

// HashSet<T>
const set = new HashSet<string>();
set.add("a");
set.add("b");
Console.writeLine(set.contains("a"));
```

### LINQ

```typescript
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";

const numbers = [1, 2, 3, 4, 5];

// Query operations
const doubled = Enumerable.select(numbers, (n) => n * 2);
const filtered = Enumerable.where(numbers, (n) => n > 2);
const sum = Enumerable.sum(numbers);
const first = Enumerable.first(numbers);
const any = Enumerable.any(numbers, (n) => n > 10);
```

### JavaScript Runtime APIs (`@tsonic/js`)

Tsonic ships as a .NET compiler, but you can opt into JavaScript-style APIs by importing `@tsonic/js`
(bindings for `Tsonic.JSRuntime.dll`).

Setup:

```bash
# New project
tsonic project init --js

# Existing project
tsonic add js
```

```typescript
import { console, JSON, Math, Date, Timers } from "@tsonic/js";

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

Some APIs use a `_` suffix when a member name would collide with a TypeScript keyword.
For example, `Map.get_()` / `Map.set_()` / `Map.delete_()`.

### Extension Methods (LINQ-style `xs.where(...).select(...)`)

tsbindgen-generated packages expose **type-only** `ExtensionMethods` helpers that model C# `using` semantics.

Bring a namespace’s extension methods into scope by wrapping the receiver type:

```typescript
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";

type LinqList<T> = Linq<List<T>>;

const numbers = new List<number>() as unknown as LinqList<number>;
numbers.add(1);
numbers.add(2);
numbers.add(3);

const doubled = numbers.where((x) => x % 2 === 0).select((x) => x * 2).toList();
```

The same pattern works for `IEnumerable<T>` and `IQueryable<T>` (for example when using EF Core):

```typescript
import type { ExtensionMethods as Linq, IQueryable } from "@tsonic/dotnet/System.Linq.js";

type LinqQuery<T> = Linq<IQueryable<T>>;
declare const query: LinqQuery<number>;

query.where((x) => x > 0).select((x) => x * 2);
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

const now = DateTime.now;
const utc = DateTime.utcNow;
const date = new DateTime(2024, 1, 15);

Console.writeLine(now.year);
Console.writeLine(now.toString("yyyy-MM-dd"));

const duration = TimeSpan.fromHours(2);
const later = now.add(duration);
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
const json = JsonSerializer.serialize(user);

// Deserialize JSON to object
const parsed = JsonSerializer.deserialize<User>(json);

// Works with collections too
const users = new List<User>();
users.add({ id: 1, name: "Alice" });
users.add({ id: 2, name: "Bob" });
const usersJson = JsonSerializer.serialize(users);
```

**NativeAOT Support**: Tsonic automatically generates the required `JsonSerializerContext`
for NativeAOT compatibility. No additional configuration needed.

### String Operations

```typescript
import { String } from "@tsonic/dotnet/System.js";

const result = String.isNullOrEmpty(input);
const joined = String.join(", ", ["a", "b", "c"]);
const formatted = String.format("Hello, {0}!", name);
```

## NuGet Packages

### Adding Dependencies

In `tsonic.json`:

```json
{
  "dotnet": {
    "packageReferences": [
      { "id": "Newtonsoft.Json", "version": "13.0.3" },
      { "id": "System.Net.Http.Json", "version": "8.0.0" }
    ]
  }
}
```

### Using NuGet Types

After adding to config, install (or generate) a matching TypeScript bindings package and import from that package's namespaces:

```typescript
// Example: a tsbindgen-generated bindings package for Newtonsoft.Json
// (the package name is up to you)
import { JsonConvert } from "@my-org/newtonsoft-json/Newtonsoft.Json.js";

const json = JsonConvert.serializeObject({ name: "Alice" });
const obj = JsonConvert.deserializeObject(json);
```

## External Libraries

### Library Bindings

For custom .NET libraries, use the `libraries` config:

```json
{
  "dotnet": {
    "libraries": ["./libs/my-library"]
  }
}
```

Or via CLI:

```bash
tsonic build src/App.ts --lib ./libs/my-library
```

### Creating Bindings

Library bindings are TypeScript declaration files that describe .NET types:

```typescript
// libs/my-library/index.d.ts
export declare class MyService {
  constructor();
  doSomething(value: string): number;
}
```

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
  const content = await File.readAllTextAsync("./data.txt");
  await File.writeAllTextAsync("./output.txt", content);
}
```

## Error Handling

.NET exceptions work with TypeScript try/catch:

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { File } from "@tsonic/dotnet/System.IO.js";

try {
  const content = File.readAllText("./missing.txt");
} catch (error) {
  Console.writeLine("File not found");
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
import { int } from "@tsonic/core/types.js";

// Dictionary.tryGetValue has an 'out' parameter
import { Dictionary } from "@tsonic/dotnet/System.Collections.Generic.js";

const dict = new Dictionary<string, int>();
dict.add("key", 42);

// The 'out' parameter is handled automatically
let value: int = 0;
if (dict.tryGetValue("key", value)) {
  Console.writeLine(value); // 42
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
| `in`     | `in`       | Pass by reference, read-only      |

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
public static int ProcessValue(int? value)
{
    if (value != null)
    {
        return value.Value * 2;  // .Value access for narrowed type
    }
    return 0;
}

public static int ProcessMultiple(int? a, int? b)
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
