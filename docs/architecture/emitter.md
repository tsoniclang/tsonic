# Emitter Package

The emitter generates C# code from IR.

## Entry Points

### emitCSharpFiles

Batch emit multiple modules:

```typescript
const result = emitCSharpFiles(modules, {
  rootNamespace: "MyApp",
  entryPointPath: "/path/to/src/App.ts",
  runtime: "js",
});

if (result.ok) {
  // Map<string, string> of path -> C# code
  for (const [path, code] of result.files) {
    writeFile(path, code);
  }
}
```

### emitModule

Single module emission:

```typescript
const code = emitModule(module, {
  rootNamespace: "MyApp",
  runtime: "js",
});
```

## Emitter Context

The emitter maintains context during generation:

```typescript
type EmitterContext = {
  readonly indent: number;
  readonly runtime: "js" | "dotnet";
  readonly rootNamespace: string;
  readonly currentModule?: IrModule;
  readonly moduleMap?: ModuleMap;
  readonly exportMap?: ExportMap;
};
```

Context is passed through and updated immutably:

```typescript
const withIndent = (ctx: EmitterContext): EmitterContext => ({
  ...ctx,
  indent: ctx.indent + 1,
});
```

## Module Emission

### Module Structure

`core/module-emitter/`:

Each module generates:

1. Using directives (implicit)
2. Namespace declaration
3. Static class wrapper
4. Body statements

```csharp
// Generated structure
namespace MyApp.src.utils
{
    public static class Math
    {
        // declarations from body
    }
}
```

### Namespace Generation

```typescript
// src/utils/math.ts with rootNamespace "MyApp"
// -> namespace: MyApp.src.utils

const generateNamespace = (filePath: string, rootNamespace: string): string => {
  const dir = path.dirname(filePath);
  const parts = dir.split("/").filter((p) => p && p !== ".");
  return [rootNamespace, ...parts].join(".");
};
```

### Class Name Generation

```typescript
// math.ts -> class Math
// user-service.ts -> class user_service (hyphens to underscores)

const generateClassName = (filePath: string): string => {
  const name = path.basename(filePath, ".ts");
  return name.replace(/-/g, "_");
};
```

## Type Emission

### Primitive Types

`types/primitives.ts`:

```typescript
const primitiveMap: Record<string, string> = {
  number: "double",
  string: "string",
  boolean: "bool",
  null: "object",
  undefined: "object",
};

const emitPrimitiveType = (type: IrPrimitiveType): string => {
  return primitiveMap[type.name] ?? "object";
};
```

### Reference Types

`types/references.ts`:

```typescript
const emitReferenceType = (
  type: IrReferenceType,
  ctx: EmitterContext
): string => {
  const name = type.clrType ?? type.name;
  if (type.typeArguments?.length) {
    const args = type.typeArguments.map((t) => emitType(t, ctx)).join(", ");
    return `${name}<${args}>`;
  }
  return name;
};
```

### Array Types

```typescript
const emitArrayType = (type: IrArrayType, ctx: EmitterContext): string => {
  const elementType = emitType(type.elementType, ctx);
  if (ctx.runtime === "js") {
    return `Tsonic.Runtime.Array<${elementType}>`;
  }
  return `${elementType}[]`;
};
```

### Tuple Types

`types/tuples.ts`:

```typescript
const emitTupleType = (type: IrTupleType, ctx: EmitterContext): string => {
  const elementTypes = type.elementTypes.map((t) => emitType(t, ctx));
  return `ValueTuple<${elementTypes.join(", ")}>`;
};
```

Example:

```typescript
// TypeScript
const point: [number, number] = [10, 20];
```

```csharp
// Generated C#
ValueTuple<double, double> point = (10.0, 20.0);
```

### Union Types

`types/unions.ts`:

```typescript
// Simple nullable
type MaybeString = string | null;
// -> string?

// Complex union
type StringOrNumber = string | number;
// -> object (with runtime checks)
```

### Union Narrowing

The emitter generates narrowed types after type guards:

```typescript
// TypeScript with type guard
function isDog(pet: Dog | Cat): pet is Dog {
  return "bark" in pet;
}

if (isDog(pet)) {
  pet.bark(); // pet is narrowed to Dog
}
```

```csharp
// Generated C# - type is narrowed in the if block
if (isDog(pet))
{
    ((Dog)pet).bark(); // Cast to narrowed type
}
```

Narrowing contexts include:

- Type predicate functions (`x is T`)
- `typeof` checks
- Truthiness checks for nullable types
- Negated conditions (else branch)

## Expression Emission

### Literals

`expressions/literals.ts`:

```typescript
const emitLiteral = (expr: IrLiteralExpression): string => {
  if (typeof expr.value === "string") {
    return `"${escapeString(expr.value)}"`;
  }
  if (typeof expr.value === "boolean") {
    return expr.value ? "true" : "false";
  }
  if (expr.value === null) {
    return "null";
  }
  return String(expr.value);
};
```

### Binary Expressions

`expressions/operators.ts`:

```typescript
const emitBinary = (expr: IrBinaryExpression, ctx: EmitterContext): string => {
  const left = emitExpression(expr.left, ctx);
  const right = emitExpression(expr.right, ctx);
  const op = mapOperator(expr.operator);
  return `(${left}) ${op} (${right})`;
};

const mapOperator = (op: string): string => {
  switch (op) {
    case "===":
      return "=="; // C# equality
    case "!==":
      return "!=";
    case "??":
      return "??"; // Null coalescing
    default:
      return op;
  }
};
```

### Call Expressions

`expressions/calls.ts`:

```typescript
const emitCall = (expr: IrCallExpression, ctx: EmitterContext): string => {
  const callee = emitExpression(expr.callee, ctx);
  const args = expr.arguments.map((a) => emitExpression(a, ctx)).join(", ");
  return `${callee}(${args})`;
};
```

### Member Access

`expressions/access.ts`:

```typescript
const emitMember = (expr: IrMemberExpression, ctx: EmitterContext): string => {
  const obj = emitExpression(expr.object, ctx);
  if (expr.computed) {
    const prop = emitExpression(expr.property as IrExpression, ctx);
    return `${obj}[${prop}]`;
  }
  const prop = expr.property as string;
  return `${obj}.${prop}`;
};
```

## Statement Emission

### Variable Declarations

`statements/declarations.ts`:

```typescript
const emitVariableDeclaration = (
  stmt: IrVariableDeclaration,
  ctx: EmitterContext
): string => {
  return stmt.declarations
    .map((decl) => {
      const name = emitPattern(decl.pattern, ctx);
      const type = decl.type ? emitType(decl.type, ctx) : "var";
      const init = decl.init ? emitExpression(decl.init, ctx) : undefined;
      return init ? `${type} ${name} = ${init};` : `${type} ${name};`;
    })
    .join("\n");
};
```

### Function Declarations

`statements/declarations/functions.ts`:

```typescript
const emitFunction = (
  stmt: IrFunctionDeclaration,
  ctx: EmitterContext
): string => {
  const modifiers = ["public", "static"];
  if (stmt.isAsync) modifiers.push("async");

  const returnType = stmt.returnType ? emitType(stmt.returnType, ctx) : "void";

  const params = stmt.parameters
    .map((p) => `${emitType(p.type, ctx)} ${p.name}`)
    .join(", ");

  const body = emitBlock(stmt.body, ctx);

  return `${modifiers.join(" ")} ${returnType} ${stmt.name}(${params})\n${body}`;
};
```

### Class Declarations

`statements/classes/`:

```typescript
const emitClass = (stmt: IrClassDeclaration, ctx: EmitterContext): string => {
  const modifiers = ["public"];
  if (stmt.isAbstract) modifiers.push("abstract");

  let header = `${modifiers.join(" ")} class ${stmt.name}`;
  if (stmt.extends) {
    header += ` : ${emitType(stmt.extends, ctx)}`;
  }

  const members = stmt.members.map((m) => emitClassMember(m, ctx)).join("\n\n");

  return `${header}\n{\n${indent(members)}\n}`;
};
```

### Anonymous Object Synthesis

Object literals without explicit type annotations auto-synthesize nominal classes:

```typescript
// TypeScript
const point = { x: 10, y: 20 };
```

```csharp
// Generated C# - synthesized class
public class __Anon_main_5_15
{
    public double x { get; set; }
    public double y { get; set; }
}

// Usage
var point = new __Anon_main_5_15 { x = 10.0, y = 20.0 };
```

Synthesized class names follow the pattern: `__Anon_{file}_{line}_{col}`

Eligible patterns:

- Property assignments
- Shorthand properties
- Arrow function properties

Ineligible patterns (error TSN7405):

- Method shorthand
- Getters/setters
- Spread elements

## FQN Emission

Fully qualified names ensure no ambiguity:

`emitter-types/fqn.ts`:

```typescript
const emitFQN = (typeName: string, namespace: string): string => {
  return `global::${namespace}.${typeName}`;
};

// Usage in generated code:
// global::System.Console.WriteLine("Hello");
```

## Generic Specialization

`specialization/`:

Generic types are specialized at use sites:

```typescript
// TypeScript
function identity<T>(x: T): T { return x; }
const n = identity<number>(42);

// C# (no specialization needed for simple cases)
public static T identity<T>(T x) { return x; }
var n = identity<double>(42);
```

Complex cases require monomorphization.

### Generic null Handling

In generic contexts, TypeScript `null` emits as C# `default`:

```typescript
// TypeScript
function getOrNull<T>(value: T | null): T | null {
  return value ?? null;
}
```

```csharp
// Generated C#
public static T? getOrNull<T>(T? value)
{
    return value ?? default; // 'default' instead of 'null'
}
```

This ensures correct behavior for both reference and value types.

## JSON AOT Support

The emitter provides automatic NativeAOT-compatible JSON serialization:

### Detection

`expressions/calls.ts` detects `JsonSerializer` calls via binding resolution:

```typescript
const isJsonSerializerCall = (callee: IrExpression): boolean => {
  if (callee.kind !== "memberAccess") return false;
  return callee.memberBinding?.type === "System.Text.Json.JsonSerializer";
};
```

### Type Collection

Types are collected in a shared registry during emission:

```typescript
type JsonAotRegistry = {
  rootTypes: Set<string>; // e.g., "global::MyApp.User"
  needsJsonAot: boolean;
};
```

### Call Rewriting

Calls are rewritten to use generated options:

```typescript
// Before: JsonSerializer.Serialize(user)
// After:  JsonSerializer.Serialize(user, TsonicJson.Options)
```

### Context Generation

When `needsJsonAot` is true, generates `__tsonic_json.g.cs`:

```csharp
[JsonSerializable(typeof(global::MyApp.User))]
internal partial class __TsonicJsonContext : JsonSerializerContext { }

internal static class TsonicJson {
    internal static readonly JsonSerializerOptions Options = new() {
        TypeInfoResolver = __TsonicJsonContext.Default
    };
}
```

## Generator Emission

`generator-wrapper.ts` and `generator-exchange.ts`:

### Simple Generators

Basic generators emit as `IEnumerable<T>`:

```csharp
public static IEnumerable<double> counter()
{
    yield return 1.0;
    yield return 2.0;
}
```

### Bidirectional Generators

Generators with `TNext` type emit with wrapper classes:

```typescript
function* acc(): Generator<number, void, number> {
  let total = 0;
  while (true) {
    const v = yield total;
    total += v;
  }
}
```

Generates:

1. **Exchange class** for bidirectional communication:

```csharp
public sealed class acc_exchange
{
    public double? Input { get; set; }
    public double Output { get; set; }
}
```

2. **Wrapper class** with JavaScript-style API:

```csharp
public sealed class acc_Generator
{
    private readonly IEnumerator<acc_exchange> _enumerator;
    private readonly acc_exchange _exchange;
    private bool _done = false;

    public IteratorResult<double> next(double? value = default) { ... }
    public IteratorResult<double> @return(object? value = default) { ... }
    public IteratorResult<double> @throw(object e) { ... }
}
```

3. **Core iterator** returning `IEnumerable<exchange>`:

```csharp
IEnumerable<acc_exchange> __iterator()
{
    var total = 0.0;
    while (true)
    {
        exchange.Output = total;
        yield return exchange;
        var v = exchange.Input ?? 0.0;
        total = total + v;
    }
}
```

### IteratorResult

Located in `Tsonic.Runtime`:

```csharp
public readonly record struct IteratorResult<T>(T value, bool done);
```

Used with fully qualified names to avoid module collisions:

```csharp
global::Tsonic.Runtime.IteratorResult<double>
```

### Async Generators

Async generators follow the same pattern but with:

- `IAsyncEnumerable<exchange>` instead of `IEnumerable`
- `async` methods in wrapper class
- `await foreach` for iteration

## Module Map

For cross-file import resolution:

```typescript
type ModuleMap = Map<
  string,
  {
    namespace: string;
    className: string;
    exports: Map<string, ExportInfo>;
  }
>;
```

Used to resolve imports:

```typescript
// import { foo } from "./utils.js"
// -> MyApp.src.utils.foo
```

## Golden Tests

The emitter uses golden tests to verify C# output.

### Test Structure

```
packages/emitter/testcases/
├── common/                    # Run in both js and dotnet modes
│   ├── types/
│   │   ├── generics/
│   │   ├── type-assertions/
│   │   └── anonymous-objects/
│   ├── expressions/
│   └── attributes/
└── js-only/                   # Only run in js mode
    ├── real-world/
    └── arrays/
```

### Test Discovery

`golden-tests/discovery.ts`:

- Discovers test cases from `testcases/` directory
- Filters by mode (`common`, `js-only`, `dotnet-only`)
- Generates test suites dynamically

```typescript
const discoverTests = (baseDir: string, mode: "js" | "dotnet"): TestCase[] => {
  const tests: TestCase[] = [];

  // Always include common/
  tests.push(...findTestsIn(path.join(baseDir, "common")));

  // Include mode-specific tests
  if (mode === "js") {
    tests.push(...findTestsIn(path.join(baseDir, "js-only")));
  } else {
    tests.push(...findTestsIn(path.join(baseDir, "dotnet-only")));
  }

  return tests;
};
```

### Writing Golden Tests

Each test case has:

1. **Input**: `TestName.ts` - TypeScript source
2. **Expected**: `TestName.golden.cs` - Expected C# output

```typescript
// TestName.ts
export function add(a: number, b: number): number {
  return a + b;
}
```

```csharp
// TestName.golden.cs
public static double add(double a, double b)
{
    return a + b;
}
```

### Updating Golden Files

```bash
# Update all golden files
npm run update-golden

# Update specific test
npm run update-golden -- --filter "TypeAssertions"
```
