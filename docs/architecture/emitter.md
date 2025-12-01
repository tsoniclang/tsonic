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
// import { foo } from "./utils.ts"
// -> MyApp.src.utils.foo
```
