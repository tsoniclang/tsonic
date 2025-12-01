# Runtime Packages

Tsonic provides two runtime packages for different purposes:

1. **Tsonic.Runtime** - TypeScript language primitives (always required)
2. **Tsonic.JSRuntime** - JavaScript semantics (only for `mode: "js"`)

---

## Tsonic.Runtime (Always Required)

TypeScript language features that don't exist in C#.

### Union Types

TypeScript unions compile to generic `Union<T1, T2, ...>` types:

```typescript
// TypeScript
function getValue(): string | number {
  return Math.random() > 0.5 ? "hello" : 42;
}

const value = getValue();
if (typeof value === "string") {
  console.log(value.toUpperCase());
} else {
  console.log(value * 2);
}
```

```csharp
// Generated C#
using Tsonic.Runtime;

public static Union<string, double> getValue()
{
    return Math.Random() > 0.5 ? "hello" : 42.0;
}

var value = getValue();
value.Match(
    str => Console.WriteLine(str.ToUpper()),
    num => Console.WriteLine(num * 2)
);
```

**Union methods:**

- `Is1()`, `Is2()`, ... - Check which type
- `As1()`, `As2()`, ... - Extract value (throws if wrong type)
- `TryAs1(out T1)`, ... - Try extract value
- `Match<TResult>(...)` - Pattern matching

### typeof Operator

JavaScript-style type checking:

```typescript
typeof "hello"; // "string"
typeof 42; // "number"
typeof true; // "boolean"
typeof {}; // "object"
typeof undefined; // "undefined"
typeof null; // "object" (JavaScript quirk)
typeof (() => {}); // "function"
```

```csharp
using Tsonic.Runtime;

Operators.@typeof("hello"); // "string"
Operators.@typeof(42.0); // "number"
Operators.@typeof(true); // "boolean"
```

### Structural Typing

TypeScript uses structural typing. Tsonic provides `Structural.Clone<T>()` for type compatibility:

```typescript
interface Point {
  x: number;
  y: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

function use2DPoint(p: Point): void {
  console.log(`Point: ${p.x}, ${p.y}`);
}

const p3d: Point3D = { x: 1, y: 2, z: 3 };
use2DPoint(p3d); // OK - structural typing
```

```csharp
using Tsonic.Runtime;

public static void use2DPoint(Point p)
{
    Console.WriteLine($"Point: {p.x}, {p.y}");
}

var p3d = new Point3D { x = 1, y = 2, z = 3 };
use2DPoint(Structural.Clone<Point>(p3d));
```

### Index Signatures

TypeScript index signatures `{ [key: string]: T }` compile to `DictionaryAdapter<T>`:

```typescript
interface StringMap {
  [key: string]: string;
}

const map: StringMap = {};
map["hello"] = "world";
console.log(map["hello"]); // "world"
```

```csharp
using Tsonic.Runtime;

var map = new DictionaryAdapter<string>(new Dictionary<string, object?>());
map["hello"] = "world";
Console.WriteLine(map["hello"]); // "world"
```

---

## Tsonic.JSRuntime (Only mode: "js")

JavaScript semantics for built-in types via extension methods. **Only required when `mode: "js"`.**

With `mode: "dotnet"` (default), built-in methods use native .NET BCL APIs instead.

### Array Extension Methods

JavaScript array methods on `List<T>`:

#### Functional Methods

```typescript
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map((x) => x * 2);
const evens = numbers.filter((x) => x % 2 === 0);
const sum = numbers.reduce((acc, x) => acc + x, 0);
```

```csharp
// Generated C# (mode: "js")
using Tsonic.JSRuntime;

var numbers = new List<double> { 1.0, 2.0, 3.0, 4.0, 5.0 };
var doubled = numbers.map(x => x * 2);        // Extension method
var evens = numbers.filter(x => x % 2 == 0);  // Extension method
var sum = numbers.reduce((acc, x) => acc + x, 0.0);
```

#### Mutation Methods

```typescript
const arr = [1, 2, 3];
arr.push(4); // Add to end
const last = arr.pop(); // Remove from end
arr.unshift(0); // Add to start
const first = arr.shift(); // Remove from start
```

```csharp
// Generated C# (mode: "js")
using Tsonic.JSRuntime;

var arr = new List<double> { 1.0, 2.0, 3.0 };
arr.push(4.0);         // Extension method
var last = arr.pop();
arr.unshift(0);
var first = arr.shift();
```

**Complete list:** `push`, `pop`, `shift`, `unshift`, `slice`, `splice`, `concat`, `indexOf`, `lastIndexOf`, `includes`, `join`, `reverse`, `sort`, `map`, `filter`, `reduce`, `reduceRight`, `forEach`, `every`, `some`, `find`, `findIndex`

### String Extension Methods

JavaScript string methods on native `string`:

```typescript
const text = "Hello World";
text.slice(0, 5); // "Hello"
text.slice(-5); // "World"
text.toUpperCase(); // "HELLO WORLD"
text.toLowerCase(); // "hello world"
text.includes("World"); // true
```

```csharp
// Generated C# (mode: "js")
using Tsonic.JSRuntime;

var text = "Hello World";
text.slice(0, 5);        // Extension method
text.slice(-5);          // Extension method
text.toUpperCase();      // Extension method
text.toLowerCase();      // Extension method
text.includes("World");  // Extension method
```

**Complete list:** `slice`, `substring`, `charAt`, `charCodeAt`, `indexOf`, `lastIndexOf`, `includes`, `startsWith`, `endsWith`, `trim`, `trimStart`, `trimEnd`, `repeat`, `replace`, `replaceAll`, `split`, `toUpperCase`, `toLowerCase`, `padStart`, `padEnd`

### Math Static Class

JavaScript Math object:

```typescript
Math.floor(4.7); // 4
Math.ceil(4.3); // 5
Math.round(4.5); // 5 (half-up)
Math.random(); // Random [0, 1)
Math.max(1, 5, 3); // 5
Math.min(1, 5, 3); // 1
```

```csharp
// Generated C# (mode: "js")
using Tsonic.JSRuntime;

Math.floor(4.7);
Math.ceil(4.3);
Math.round(4.5);  // JavaScript half-up rounding
Math.random();
Math.max(1, 5, 3);
Math.min(1, 5, 3);
```

### console Static Class

JavaScript console API:

```typescript
console.log("Hello", "World");
console.error("Error occurred");
console.warn("Warning message");
```

```csharp
// Generated C# (mode: "js")
using Tsonic.JSRuntime;

console.log("Hello", "World");
console.error("Error occurred");
console.warn("Warning message");
```

### JSON Static Class

Parse and stringify JSON:

```typescript
const obj = { name: "John", age: 30 };
const json = JSON.stringify(obj);

type User = { name: string; age: number };
const user: User = JSON.parse(json);
```

```csharp
// Generated C# (mode: "js")
using Tsonic.JSRuntime;

var obj = new { name = "John", age = 30 };
var json = JSON.stringify(obj);

var user = JSON.parse<User>(json);
```

### Globals Static Class

Global JavaScript functions:

```typescript
const num = parseInt("42", 10);
const pi = parseFloat("3.14");
const invalid = isNaN(num);
const ok = isFinite(num);
```

```csharp
// Generated C# (mode: "js")
using Tsonic.JSRuntime;

var num = Globals.parseInt("42", 10);
var pi = Globals.parseFloat("3.14");
var invalid = Globals.isNaN(num);
var ok = Globals.isFinite(num);
```

---

## Mode Comparison

### mode: "dotnet" (Default)

**No JSRuntime dependency** - uses native .NET BCL:

```typescript
const arr = [1, 2, 3];
arr.push(4);
const doubled = arr.map((x) => x * 2);
```

```csharp
// Generated C# (mode: "dotnet")
using System.Collections.Generic;
using System.Linq;

var arr = new List<double> { 1.0, 2.0, 3.0 };
arr.Add(4.0);  // BCL method
var doubled = arr.Select(x => x * 2).ToList();  // LINQ
```

**Package references:**

```xml
<PackageReference Include="Tsonic.Runtime" Version="1.0.0" />
<!-- NO Tsonic.JSRuntime -->
```

### mode: "js"

**With JSRuntime** - uses JavaScript semantics:

```typescript
const arr = [1, 2, 3];
arr.push(4);
const doubled = arr.map((x) => x * 2);
```

```csharp
// Generated C# (mode: "js")
using Tsonic.JSRuntime;

var arr = new List<double> { 1.0, 2.0, 3.0 };
arr.push(4.0);  // Extension method
var doubled = arr.map(x => x * 2);  // Extension method
```

**Package references:**

```xml
<PackageReference Include="Tsonic.Runtime" Version="1.0.0" />
<PackageReference Include="Tsonic.JSRuntime" Version="1.0.0" />
```

---

## When to Use Each Mode

### Use mode: "dotnet" (default) when:

- Building .NET applications
- Integrating with .NET libraries
- Performance is critical (LINQ is highly optimized)
- You want idiomatic C# code

### Use mode: "js" when:

- Porting existing JavaScript/TypeScript code
- Need exact JavaScript semantics
- Working with algorithms that depend on JS behavior
- Maintaining compatibility with JS codebase

---

## See Also

- [Type Mappings](type-mappings.md) - TypeScript → C# type conversions
- [.NET Interop](dotnet-interop.md) - Using .NET libraries
- [Module System](module-system.md) - Imports and exports
- [Configuration](../configuration.md) - Setting compilation mode
