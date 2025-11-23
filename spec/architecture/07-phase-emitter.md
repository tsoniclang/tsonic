# Phase 6: C# Code Emission

## Purpose

This phase generates C# code from IR, applying specialization (monomorphization) for generics, creating structural adapters, generating entry points. When `runtime: "js"` (default), JavaScript semantics are preserved through Tsonic.Runtime calls. When `runtime: "dotnet"`, native .NET APIs are used directly.

---

## 1. Overview

**Responsibility:** IR → C# code generation with specialization and runtime integration

**Package:** `@tsonic/emitter`

**Location:** `packages/emitter/src/`

**Input:** IrModule[] (from Phase 4)

**Output:** C# source files with .NET-compatible code

---

## 2. Key Files

```
packages/emitter/src/
├── emitter.ts                  # Public API
├── core/
│   ├── module-emitter/
│   │   ├── orchestrator.ts    # Main module emission
│   │   ├── header.ts          # File header generation
│   │   ├── separation.ts      # Statement separation
│   │   ├── namespace.ts       # Namespace-level declarations
│   │   ├── static-container.ts # Static class emission
│   │   └── assembly.ts        # Output assembly
│   ├── imports.ts             # Using directives
│   ├── exports.ts             # Export handling
│   └── type-params.ts         # Type parameter collection
├── specialization-generator.ts # Monomorphization orchestrator
├── specialization/
│   ├── collection.ts          # Collect specialization requests
│   ├── generation.ts          # Generate specialized versions
│   ├── substitution.ts        # Type substitution
│   ├── naming.ts              # Specialized name generation
│   └── helpers.ts             # Utility functions
├── adapter-generator.ts       # Structural adapter generation
├── generator-exchange.ts      # Generator exchange objects
├── expression-emitter.ts      # Expression dispatcher
├── expressions/
│   ├── literals.ts            # Literal emission
│   ├── identifiers.ts         # Identifier emission
│   ├── collections.ts         # Array/object literals
│   ├── access.ts              # Member access
│   ├── calls.ts               # Function calls
│   ├── operators.ts           # Binary/unary operators
│   ├── functions.ts           # Function expressions
│   └── other.ts               # Conditionals, templates, etc.
├── statement-emitter.ts       # Statement dispatcher
├── statements/
│   ├── declarations.ts        # Var, func, class, enum, etc.
│   ├── blocks.ts              # Blocks and returns
│   └── control.ts             # If, while, for, try, etc.
├── type-emitter.ts            # Type emission
└── types/
    ├── emitter.ts             # Type emission logic
    ├── primitives.ts          # Primitive types
    ├── functions.ts           # Function types
    ├── unions.ts              # Union types
    └── objects.ts             # Object types
```

---

## 3. Core Data Structures

### 3.1 EmitterContext

```typescript
type EmitterContext = {
  readonly options: EmitterOptions;
  readonly indentLevel: number;
  readonly usings: ReadonlySet<string>; // using directives
  readonly specializations: SpecializationMap; // Generated specializations
  readonly adapters: AdapterMap; // Structural adapters
  readonly generatorExchanges: GeneratorExchangeMap;
  readonly inClass: boolean; // Inside class context
  readonly inStaticMethod: boolean; // Inside static method
};

type EmitterOptions = {
  readonly indent: string; // "  " (2 spaces)
  readonly rootNamespace: string; // "MyApp"
  readonly sourceRoot: string; // "/src"
  readonly isEntryPoint: boolean; // Generate Main() method
  readonly entryPointPath?: string; // Path to entry point module
};
```

### 3.2 CSharpFragment

```typescript
type CSharpFragment = {
  readonly code: string;
  readonly requiresParentheses?: boolean;
  readonly type?: IrType;
};
```

### 3.3 SpecializationRequest

```typescript
type SpecializationRequest = {
  readonly kind: "function" | "class";
  readonly name: string;
  readonly typeArguments: readonly IrType[];
  readonly declaration: IrFunctionDeclaration | IrClassDeclaration;
};

type SpecializationKey = string; // Serialized signature

type SpecializationMap = ReadonlyMap<SpecializationKey, SpecializationEntry>;

type SpecializationEntry = {
  readonly request: SpecializationRequest;
  readonly specializedName: string;
  readonly code: string;
};
```

---

## 4. Emission Algorithm

### 4.1 Main Orchestrator

```typescript
const emitModule = (
  module: IrModule,
  options: Partial<EmitterOptions> = {}
): string => {
  const finalOptions: EmitterOptions = { ...defaultOptions, ...options };
  const context = createContext(finalOptions);

  // 1. Generate file header (using directives, nullable context)
  const header = generateHeader(module, finalOptions);

  // 2. Process imports to collect using statements
  const processedContext = processImports(module.imports, context, module);

  // 3. Collect type parameters and generate adapters
  const typeParams = collectTypeParameters(module);
  const [adaptersCode, adaptersContext] = generateStructuralAdapters(
    typeParams,
    processedContext
  );

  // 4. Collect specializations and generate monomorphized versions
  const specializations = collectSpecializations(module);
  const [specializationsCode, specializationsContext] = generateSpecializations(
    specializations,
    adaptersContext
  );

  // 5. Generate exchange objects for generators
  const [exchangesCode, exchangesContext] = generateGeneratorExchanges(
    module,
    specializationsContext
  );

  // 6. Separate namespace-level declarations from static container members
  const { namespaceLevelDecls, staticContainerMembers, hasInheritance } =
    separateStatements(module);

  // 7. Emit namespace-level declarations (classes, interfaces)
  const namespaceResult = emitNamespaceDeclarations(
    namespaceLevelDecls,
    exchangesContext,
    hasInheritance
  );

  // 8. Emit static container class unless there's a class with same name
  let staticContainerCode = "";
  let finalContext = namespaceResult.context;

  if (!hasMatchingClassName(namespaceLevelDecls, module.className)) {
    const containerResult = emitStaticContainer(
      module,
      staticContainerMembers,
      exchangesContext,
      hasInheritance
    );
    staticContainerCode = containerResult.code;
    finalContext = containerResult.context;
  }

  // 9. Assemble final output
  const parts: AssemblyParts = {
    header,
    adaptersCode,
    specializationsCode,
    exchangesCode,
    namespaceDeclsCode: namespaceResult.code,
    staticContainerCode,
  };

  return assembleOutput(module, parts, finalContext);
};
```

---

## 5. Import Processing

### 5.1 Collect Using Directives

```typescript
const processImports = (
  imports: readonly IrImport[],
  context: EmitterContext,
  module: IrModule
): EmitterContext => {
  let usings = new Set(context.usings);

  for (const imp of imports) {
    if (imp.isDotNet) {
      // .NET import: import { File } from "System.IO"
      // Add using directive: using System.IO;
      usings.add(imp.resolvedNamespace!);
    } else if (imp.resolvedClrType) {
      // Binding import: import console from "console"
      // Add using directive from assembly
      const parts = imp.resolvedClrType.split(".");
      const namespace = parts.slice(0, -1).join(".");
      usings.add(namespace);
    } else if (imp.isLocal) {
      // Local import: import { User } from "./models/User.ts"
      // Add using directive for imported module's namespace
      const importedNamespace = getNamespaceFromPath(
        imp.resolvedPath!,
        context.options.sourceRoot,
        context.options.rootNamespace
      );
      if (importedNamespace !== module.namespace) {
        usings.add(importedNamespace);
      }
    }
  }

  return {
    ...context,
    usings,
  };
};
```

### 5.2 Generate Header

```typescript
const generateHeader = (module: IrModule, options: EmitterOptions): string => {
  const lines: string[] = [];

  // File comment
  lines.push(`// Generated from ${path.basename(module.filePath)}`);
  lines.push(`// Tsonic Compiler ${VERSION}`);
  lines.push("");

  // Nullable reference types
  lines.push("#nullable enable");
  lines.push("");

  // Using directives (will be added during emission)
  // They are collected separately and inserted later

  return lines.join("\n");
};
```

---

## 6. Specialization (Monomorphization)

### 6.1 Collection Phase

```typescript
const collectSpecializations = (
  module: IrModule
): readonly SpecializationRequest[] => {
  const requests: SpecializationRequest[] = [];
  const declarations = new Map<
    string,
    IrFunctionDeclaration | IrClassDeclaration
  >();

  // Collect generic declarations
  for (const stmt of module.body) {
    if (stmt.kind === "functionDeclaration" && stmt.typeParameters) {
      declarations.set(stmt.name, stmt);
    }
    if (stmt.kind === "classDeclaration" && stmt.typeParameters) {
      declarations.set(stmt.name, stmt);
    }
  }

  // Find call sites that require specialization
  const visitor = (expr: IrExpression): void => {
    if (expr.kind === "call") {
      const callee = expr.callee;
      if (callee.kind === "identifier") {
        const decl = declarations.get(callee.name);
        if (decl && expr.typeArguments) {
          requests.push({
            kind: decl.kind === "functionDeclaration" ? "function" : "class",
            name: callee.name,
            typeArguments: expr.typeArguments,
            declaration: decl,
          });
        }
      }
    }

    // Recursively visit subexpressions
    visitSubexpressions(expr, visitor);
  };

  // Visit all expressions in module
  for (const stmt of module.body) {
    visitExpressionsInStatement(stmt, visitor);
  }

  return requests;
};
```

### 6.2 Generation Phase

```typescript
const generateSpecializations = (
  requests: readonly SpecializationRequest[],
  context: EmitterContext
): [string, EmitterContext] => {
  const code: string[] = [];
  let currentContext = context;
  const specializationMap = new Map(currentContext.specializations);

  for (const request of requests) {
    const key = createSpecializationKey(request);

    // Skip if already generated
    if (specializationMap.has(key)) continue;

    // Generate specialized name
    const specializedName =
      request.kind === "function"
        ? generateSpecializedFunctionName(request)
        : generateSpecializedClassName(request);

    // Substitute type parameters with concrete types
    const substituted = substituteDeclaration(
      request.declaration,
      request.typeArguments
    );

    // Emit specialized version
    const [specializedCode, newContext] =
      request.kind === "function"
        ? emitFunctionDeclaration(
            substituted as IrFunctionDeclaration,
            currentContext
          )
        : emitClassDeclaration(
            substituted as IrClassDeclaration,
            currentContext
          );

    // Store specialization
    specializationMap.set(key, {
      request,
      specializedName,
      code: specializedCode,
    });

    code.push(specializedCode);
    currentContext = newContext;
  }

  return [
    code.join("\n\n"),
    { ...currentContext, specializations: specializationMap },
  ];
};
```

### 6.3 Specialized Name Generation

```typescript
const generateSpecializedFunctionName = (
  request: SpecializationRequest
): string => {
  const typeNames = request.typeArguments.map((t) => serializeType(t));
  return `${request.name}__${typeNames.join("_")}`;
};

// Example:
// map<T, U>(arr: T[], fn: (x: T) => U): U[]
// Called with: map<number, string>(...)
// Generated name: map__number_string

const serializeType = (type: IrType): string => {
  switch (type.kind) {
    case "primitiveType":
      return type.name;
    case "referenceType":
      if (type.typeArguments) {
        const args = type.typeArguments.map(serializeType).join("_");
        return `${type.name}_${args}`;
      }
      return type.name;
    case "arrayType":
      return `${serializeType(type.elementType)}_array`;
    default:
      return "any";
  }
};
```

---

## 7. Expression Emission

### 7.1 Main Dispatcher

```typescript
const emitExpression = (
  expr: IrExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  switch (expr.kind) {
    case "literal":
      return emitLiteral(expr, context);
    case "identifier":
      return emitIdentifier(expr, context);
    case "array":
      return emitArray(expr, context, expectedType);
    case "object":
      return emitObject(expr, context);
    case "memberAccess":
      return emitMemberAccess(expr, context);
    case "call":
      return emitCall(expr, context);
    case "new":
      return emitNew(expr, context);
    case "binary":
      return emitBinary(expr, context);
    case "unary":
      return emitUnary(expr, context);
    case "conditional":
      return emitConditional(expr, context);
    case "arrowFunction":
      return emitArrowFunction(expr, context);
    // ... other cases
  }
};
```

### 7.2 Literal Emission

```typescript
const emitLiteral = (
  expr: IrLiteralExpression,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  if (expr.value === null) {
    return [{ code: "null" }, context];
  }
  if (expr.value === undefined) {
    return [{ code: "Undefined.Value" }, context]; // Tsonic.Runtime.Undefined
  }
  if (typeof expr.value === "string") {
    // Escape C# string
    const escaped = expr.value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    return [{ code: `"${escaped}"` }, context];
  }
  if (typeof expr.value === "number") {
    // Handle special values
    if (Number.isNaN(expr.value)) {
      return [{ code: "double.NaN" }, context];
    }
    if (expr.value === Infinity) {
      return [{ code: "double.PositiveInfinity" }, context];
    }
    if (expr.value === -Infinity) {
      return [{ code: "double.NegativeInfinity" }, context];
    }
    return [{ code: expr.value.toString() }, context];
  }
  if (typeof expr.value === "boolean") {
    return [{ code: expr.value ? "true" : "false" }, context];
  }

  return [{ code: "null" }, context];
};
```

### 7.3 Array Emission

```typescript
const emitArray = (
  expr: IrArrayExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;

  // Infer element type
  const elementType =
    expectedType?.kind === "arrayType"
      ? expectedType.elementType
      : inferElementType(expr.elements);

  const [elementTypeCode] = emitType(elementType, currentContext);

  // Emit elements
  const elementCodes: string[] = [];
  for (const element of expr.elements) {
    if (element === undefined) {
      // Sparse array hole
      elementCodes.push("/* hole */");
    } else if (element.kind === "spread") {
      // Spread not directly supported in array literals
      // This should be handled by Array.from or similar
      throw new Error("Spread in array literal not yet supported");
    } else {
      const [elementCode, newContext] = emitExpression(
        element,
        currentContext,
        elementType
      );
      elementCodes.push(elementCode.code);
      currentContext = newContext;
    }
  }

  // Use List<T> constructor with collection initializer
  const code = `new List<${elementTypeCode}> { ${elementCodes.join(", ")} }`;

  return [{ code }, currentContext];
};
```

### 7.4 Call Emission

```typescript
const emitCall = (
  expr: IrCallExpression,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;

  // Emit callee
  const [calleeCode, calleeContext] = emitExpression(
    expr.callee,
    currentContext
  );
  currentContext = calleeContext;

  // Check for specialized call
  let finalCallee = calleeCode.code;
  if (expr.typeArguments && expr.callee.kind === "identifier") {
    const key = createSpecializationKey({
      kind: "function",
      name: expr.callee.name,
      typeArguments: expr.typeArguments,
      declaration: null as any, // Not needed for lookup
    });
    const specialization = currentContext.specializations.get(key);
    if (specialization) {
      finalCallee = specialization.specializedName;
    }
  }

  // Emit arguments
  const argCodes: string[] = [];
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      // Spread in arguments - use params array syntax
      const [spreadCode, newContext] = emitExpression(
        arg.expression,
        currentContext
      );
      argCodes.push(`...(${spreadCode.code})`);
      currentContext = newContext;
    } else {
      const [argCode, newContext] = emitExpression(arg, currentContext);
      argCodes.push(argCode.code);
      currentContext = newContext;
    }
  }

  const code = `${finalCallee}(${argCodes.join(", ")})`;

  return [{ code }, currentContext];
};
```

---

## 8. Statement Emission

### 8.1 Variable Declaration

```typescript
const emitVariableDeclaration = (
  stmt: IrVariableDeclaration,
  context: EmitterContext
): [string, EmitterContext] => {
  let currentContext = context;
  const lines: string[] = [];
  const ind = getIndent(context);

  for (const declarator of stmt.declarations) {
    // Emit type
    const typeCode = declarator.type
      ? emitType(declarator.type, currentContext)[0]
      : "var"; // Type inference

    // Emit pattern (identifier or destructuring)
    const patternCode = emitPattern(declarator.name);

    // Emit initializer
    let initCode = "";
    if (declarator.init) {
      const [initFragment, newContext] = emitExpression(
        declarator.init,
        currentContext,
        declarator.type
      );
      initCode = ` = ${initFragment.code}`;
      currentContext = newContext;
    }

    lines.push(`${ind}${typeCode} ${patternCode}${initCode};`);
  }

  return [lines.join("\n"), currentContext];
};
```

### 8.2 Function Declaration

```typescript
const emitFunctionDeclaration = (
  stmt: IrFunctionDeclaration,
  context: EmitterContext
): [string, EmitterContext] => {
  let currentContext = context;
  const lines: string[] = [];
  const ind = getIndent(context);

  // Emit return type
  const returnTypeCode = stmt.returnType
    ? emitType(stmt.returnType, currentContext)[0]
    : "void";

  // Emit parameters
  const paramCodes: string[] = [];
  for (const param of stmt.parameters) {
    const paramTypeCode = param.type
      ? emitType(param.type, currentContext)[0]
      : "object";
    const paramName = param.name;
    const optional = param.optional ? " = null" : "";
    paramCodes.push(`${paramTypeCode} ${paramName}${optional}`);
  }

  // Function signature
  const modifiers = context.inClass ? "public static" : "public";
  const signature = `${modifiers} ${returnTypeCode} ${stmt.name}(${paramCodes.join(", ")})`;

  lines.push(`${ind}${signature}`);

  // Emit body
  if (stmt.body) {
    const bodyContext = {
      ...currentContext,
      indentLevel: currentContext.indentLevel + 1,
    };
    const [bodyCode, newContext] = emitBlockStatement(stmt.body, bodyContext);
    lines.push(bodyCode);
    currentContext = newContext;
  }

  return [lines.join("\n"), currentContext];
};
```

### 8.3 Class Declaration

```typescript
const emitClassDeclaration = (
  stmt: IrClassDeclaration,
  context: EmitterContext
): [string, EmitterContext] => {
  let currentContext = context;
  const lines: string[] = [];
  const ind = getIndent(context);

  // Class signature
  let signature = `public class ${stmt.name}`;
  if (stmt.typeParameters) {
    const typeParamNames = stmt.typeParameters.map((tp) => tp.name);
    signature += `<${typeParamNames.join(", ")}>`;
  }
  if (stmt.extends) {
    signature += ` : ${stmt.extends}`;
  }
  if (stmt.implements) {
    const prefix = stmt.extends ? ", " : " : ";
    signature += `${prefix}${stmt.implements.join(", ")}`;
  }

  lines.push(`${ind}${signature}`);
  lines.push(`${ind}{`);

  // Emit members
  const memberContext = {
    ...currentContext,
    indentLevel: currentContext.indentLevel + 1,
    inClass: true,
  };
  for (const member of stmt.members) {
    const [memberCode, newContext] = emitClassMember(member, memberContext);
    lines.push(memberCode);
    currentContext = newContext;
  }

  lines.push(`${ind}}`);

  return [lines.join("\n"), currentContext];
};
```

---

## 9. Type Emission

### 9.1 Main Dispatcher

```typescript
const emitType = (
  type: IrType,
  context: EmitterContext
): [string, EmitterContext] => {
  switch (type.kind) {
    case "primitiveType":
      return emitPrimitiveType(type);
    case "referenceType":
      return emitReferenceType(type, context);
    case "arrayType":
      return emitArrayType(type, context);
    case "functionType":
      return emitFunctionType(type, context);
    case "objectType":
      return emitObjectType(type, context);
    case "unionType":
      return emitUnionType(type, context);
    case "anyType":
      return ["object", context];
    case "voidType":
      return ["void", context];
    default:
      return ["object", context];
  }
};
```

### 9.2 Primitive Type Mapping

```typescript
const emitPrimitiveType = (type: IrPrimitiveType): [string, EmitterContext] => {
  const mapping: Record<string, string> = {
    string: "string",
    number: "double",
    boolean: "bool",
    null: "object?",
    undefined: "object?",
  };

  return [mapping[type.name] || "object", context];
};
```

### 9.3 Array Type

```typescript
const emitArrayType = (
  type: IrArrayType,
  context: EmitterContext
): [string, EmitterContext] => {
  const [elementTypeCode, newContext] = emitType(type.elementType, context);

  // Use List<T> for mutable arrays with JS semantics
  return [`List<${elementTypeCode}>`, newContext];
};
```

---

## 10. Static Container vs Namespace Declarations

### 10.1 Statement Separation

```typescript
const separateStatements = (
  module: IrModule
): {
  namespaceLevelDecls: readonly IrStatement[];
  staticContainerMembers: readonly IrStatement[];
  hasInheritance: boolean;
} => {
  const namespaceLevelDecls: IrStatement[] = [];
  const staticContainerMembers: IrStatement[] = [];
  let hasInheritance = false;

  for (const stmt of module.body) {
    if (
      stmt.kind === "classDeclaration" ||
      stmt.kind === "interfaceDeclaration" ||
      stmt.kind === "enumDeclaration" ||
      stmt.kind === "typeAliasDeclaration"
    ) {
      namespaceLevelDecls.push(stmt);
      if (
        stmt.kind === "classDeclaration" &&
        (stmt.extends || stmt.implements)
      ) {
        hasInheritance = true;
      }
    } else {
      // Functions and variables go into static container
      staticContainerMembers.push(stmt);
    }
  }

  return {
    namespaceLevelDecls,
    staticContainerMembers,
    hasInheritance,
  };
};
```

### 10.2 Static Container Emission

```typescript
const emitStaticContainer = (
  module: IrModule,
  members: readonly IrStatement[],
  context: EmitterContext,
  hasInheritance: boolean
): { code: string; context: EmitterContext } => {
  if (members.length === 0) {
    return { code: "", context };
  }

  let currentContext = context;
  const lines: string[] = [];
  const ind = getIndent(context);

  // Static class declaration
  lines.push(`${ind}public static class ${module.className}`);
  lines.push(`${ind}{`);

  // Emit members
  const memberContext = {
    ...currentContext,
    indentLevel: currentContext.indentLevel + 1,
    inClass: true,
    inStaticMethod: true,
  };

  for (const member of members) {
    const [memberCode, newContext] = emitStatement(member, memberContext);
    lines.push(memberCode);
    currentContext = newContext;
  }

  // Generate Main() entry point if this is entry module
  if (context.options.isEntryPoint) {
    const mainMethod = generateMainMethod(module, memberContext);
    lines.push(mainMethod);
  }

  lines.push(`${ind}}`);

  return {
    code: lines.join("\n"),
    context: currentContext,
  };
};
```

---

## 11. Entry Point Generation

### 11.1 Main() Method

```typescript
const generateMainMethod = (
  module: IrModule,
  context: EmitterContext
): string => {
  const lines: string[] = [];
  const ind = getIndent(context);

  lines.push(`${ind}public static void Main(string[] args)`);
  lines.push(`${ind}{`);

  // Execute top-level code
  for (const stmt of module.body) {
    if (isExecutableStatement(stmt)) {
      const stmtContext = { ...context, indentLevel: context.indentLevel + 1 };
      const [stmtCode] = emitStatement(stmt, stmtContext);
      lines.push(stmtCode);
    }
  }

  lines.push(`${ind}}`);

  return lines.join("\n");
};
```

---

## 12. Output Assembly

### 12.1 Assemble Parts

```typescript
const assembleOutput = (
  module: IrModule,
  parts: AssemblyParts,
  context: EmitterContext
): string => {
  const sections: string[] = [];

  // 1. Header with using directives
  sections.push(parts.header);

  // Add collected using directives
  const usings = Array.from(context.usings).sort();
  for (const ns of usings) {
    sections.push(`using ${ns};`);
  }
  sections.push("");

  // 2. Namespace declaration
  sections.push(`namespace ${module.namespace}`);
  sections.push("{");

  // 3. Adapters (if any)
  if (parts.adaptersCode) {
    sections.push(indent(parts.adaptersCode, 1));
    sections.push("");
  }

  // 4. Specializations (if any)
  if (parts.specializationsCode) {
    sections.push(indent(parts.specializationsCode, 1));
    sections.push("");
  }

  // 5. Generator exchanges (if any)
  if (parts.exchangesCode) {
    sections.push(indent(parts.exchangesCode, 1));
    sections.push("");
  }

  // 6. Namespace-level declarations
  if (parts.namespaceDeclsCode) {
    sections.push(indent(parts.namespaceDeclsCode, 1));
    sections.push("");
  }

  // 7. Static container
  if (parts.staticContainerCode) {
    sections.push(indent(parts.staticContainerCode, 1));
  }

  sections.push("}");

  return sections.join("\n");
};
```

---

## 13. Performance Characteristics

### 13.1 Complexity

**Expression Emission:**

- Time: O(E) where E = expressions
- Space: O(D) where D = expression depth

**Statement Emission:**

- Time: O(S) where S = statements
- Space: O(D) where D = nesting depth

**Specialization:**

- Time: O(G × C) where G = generic declarations, C = call sites
- Space: O(G × T) where T = unique type argument combinations

**Total Complexity:** O(E + S + G × C)

### 13.2 Timing

**Small Module (100 LOC):**

- Expression emission: ~10ms
- Statement emission: ~15ms
- Type emission: ~5ms
- Specialization: ~5ms
- Assembly: ~2ms
- **Total: ~37ms**

**Medium Module (500 LOC):**

- Expression emission: ~40ms
- Statement emission: ~60ms
- Type emission: ~20ms
- Specialization: ~20ms
- Assembly: ~5ms
- **Total: ~145ms**

**Large Module (2000 LOC):**

- Expression emission: ~150ms
- Statement emission: ~250ms
- Type emission: ~80ms
- Specialization: ~100ms
- Assembly: ~15ms
- **Total: ~595ms**

---

## 14. See Also

- [00-overview.md](00-overview.md) - System architecture
- [01-pipeline-flow.md](01-pipeline-flow.md) - Phase connections
- [05-phase-ir.md](05-phase-ir.md) - IR building (previous phase)
- [08-phase-backend.md](08-phase-backend.md) - NativeAOT compilation (next phase)
- [09-phase-runtime.md](09-phase-runtime.md) - Runtime APIs

---

**Document Statistics:**

- Lines: ~1,100
- Sections: 14
- Code examples: 30+
- Coverage: Complete C# emission with specialization, adapters, and runtime integration
