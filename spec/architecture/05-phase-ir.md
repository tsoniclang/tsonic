# Phase 4: IR Building

## Purpose

This phase converts TypeScript AST (from Phase 1) into an Intermediate Representation (IR), performing type inference, binding resolution, and validating that the codebase can be compiled to C#.

---

## 1. Overview

**Responsibility:** Convert TypeScript AST to IR with type information and bindings

**Package:** `@tsonic/frontend`

**Location:** `packages/frontend/src/ir/`

**Input:** TsonicProgram (from Phase 1), validated modules (from Phase 3)

**Output:** IrModule[] with complete type information and binding resolutions

---

## 2. Key Files

```
packages/frontend/src/ir/
├── builder/
│   ├── orchestrator.ts       # Main IR building logic
│   ├── imports.ts            # Import extraction
│   ├── exports.ts            # Export extraction
│   ├── statements.ts         # Statement extraction
│   ├── helpers.ts            # Utility functions
│   └── types.ts              # Builder types
├── converters/
│   ├── expressions/
│   │   ├── literals.ts       # Literal conversions
│   │   ├── collections.ts    # Array/object literals
│   │   ├── access.ts         # Member access
│   │   ├── calls.ts          # Function calls
│   │   ├── operators.ts      # Binary/unary operators
│   │   ├── functions.ts      # Function expressions
│   │   └── other.ts          # Conditionals, templates
│   └── statements/
│       ├── declarations/     # Var, func, class, enum, etc.
│       └── control/          # If, while, for, try, etc.
├── type-converter/
│   ├── orchestrator.ts       # Main type conversion
│   ├── primitives.ts         # Primitive types
│   ├── references.ts         # Type references
│   ├── arrays.ts             # Array types
│   ├── functions.ts          # Function types
│   ├── objects.ts            # Object types
│   └── unions-intersections.ts # Union/intersection types
├── expression-converter.ts   # Main expression dispatcher
├── statement-converter.ts    # Main statement dispatcher
└── types/
    ├── module.ts             # IrModule, IrImport, IrExport
    ├── ir-types.ts           # IrType hierarchy
    ├── expressions.ts        # IrExpression hierarchy
    ├── statements.ts         # IrStatement hierarchy
    └── helpers.ts            # Common types
```

---

## 3. Core Data Structures

### 3.1 IrModule

```typescript
type IrModule = {
  readonly kind: "module";
  readonly filePath: string; // /src/models/User.ts
  readonly namespace: string; // MyApp.models
  readonly className: string; // User
  readonly isStaticContainer: boolean; // true if no top-level code
  readonly imports: readonly IrImport[];
  readonly body: readonly IrStatement[];
  readonly exports: readonly IrExport[];
};
```

**Fields:**

- **filePath** - Absolute path to source file
- **namespace** - C# namespace (from directory structure)
- **className** - C# class name (from file name)
- **isStaticContainer** - If true, only contains exported functions/constants (no top-level code)
- **imports** - All import declarations
- **body** - Top-level statements (declarations, expressions)
- **exports** - All export declarations

### 3.2 IrImport

```typescript
type IrImport = {
  readonly kind: "import";
  readonly source: string; // "./User.ts" or "System.IO"
  readonly isLocal: boolean; // true for local imports
  readonly isDotNet: boolean; // true for .NET imports
  readonly specifiers: readonly IrImportSpecifier[];
  readonly resolvedNamespace?: string; // For .NET: "System.IO"
  readonly resolvedClrType?: string; // For bindings: "Tsonic.Runtime.console"
  readonly resolvedAssembly?: string; // For bindings: "Tsonic.Runtime"
};

type IrImportSpecifier =
  | { readonly kind: "default"; readonly localName: string }
  | { readonly kind: "namespace"; readonly localName: string }
  | {
      readonly kind: "named";
      readonly name: string;
      readonly localName: string;
    };
```

### 3.3 IrExport

```typescript
type IrExport =
  | {
      readonly kind: "named";
      readonly name: string;
      readonly localName: string;
    }
  | { readonly kind: "default"; readonly expression: IrExpression }
  | { readonly kind: "declaration"; readonly declaration: IrStatement };
```

### 3.4 IrType

```typescript
type IrType =
  | IrPrimitiveType // string, number, boolean, null, undefined
  | IrReferenceType // User, Array<T>, Map<K, V>
  | IrArrayType // T[]
  | IrFunctionType // (x: number) => string
  | IrObjectType // { id: number; name: string }
  | IrUnionType // string | number
  | IrIntersectionType // User & Timestamped
  | IrLiteralType // "pending" | 42 | true
  | IrAnyType // any
  | IrUnknownType // unknown
  | IrVoidType // void
  | IrNeverType; // never

type IrPrimitiveType = {
  readonly kind: "primitiveType";
  readonly name: "string" | "number" | "boolean" | "null" | "undefined";
};

type IrReferenceType = {
  readonly kind: "referenceType";
  readonly name: string;
  readonly typeArguments?: readonly IrType[];
};

type IrArrayType = {
  readonly kind: "arrayType";
  readonly elementType: IrType;
};

type IrFunctionType = {
  readonly kind: "functionType";
  readonly parameters: readonly IrParameter[];
  readonly returnType: IrType;
};
```

### 3.5 IrExpression

```typescript
type IrExpression =
  | IrLiteralExpression // "hello", 42, true, null
  | IrIdentifierExpression // console, Math, x
  | IrArrayExpression // [1, 2, 3]
  | IrObjectExpression // { x: 10, y: 20 }
  | IrFunctionExpression // function(x) { return x + 1; }
  | IrArrowFunctionExpression // (x) => x + 1
  | IrMemberExpression // obj.prop, arr[0]
  | IrCallExpression // func(x, y)
  | IrNewExpression // new User()
  | IrThisExpression // this
  | IrUpdateExpression // x++, --y
  | IrUnaryExpression // !x, -y, typeof x
  | IrBinaryExpression // x + y, a < b
  | IrLogicalExpression // x && y, a || b
  | IrConditionalExpression // x ? y : z
  | IrAssignmentExpression // x = 10, y += 5
  | IrTemplateLiteralExpression // `Hello ${name}`
  | IrSpreadExpression // ...items
  | IrAwaitExpression // await promise
  | IrYieldExpression; // yield value
```

**Example with binding resolution:**

```typescript
type IrIdentifierExpression = {
  readonly kind: "identifier";
  readonly name: string;
  readonly inferredType?: IrType;
  // Resolved binding for globals (console, Math, etc.)
  readonly resolvedClrType?: string; // "Tsonic.Runtime.console"
  readonly resolvedAssembly?: string; // "Tsonic.Runtime"
  readonly csharpName?: string; // Optional renamed identifier
};
```

**IrCallExpression with Extension Method Support:**

```typescript
type IrCallExpression = {
  readonly kind: "call";
  readonly callee: IrExpression;
  readonly arguments: readonly IrExpression[];
  readonly typeArguments?: readonly IrType[];

  // Extension method support (added when call is on Rich<T> type)
  readonly isExtensionMethod?: boolean;
  readonly extensionInfo?: {
    readonly targetType: string; // "IEnumerable_1"
    readonly declaringClass: string; // "System.Linq.Enumerable"
    readonly declaringNamespace: string; // "System.Linq"
    readonly clrMethodName: string; // "Where"
  };
};
```

When `isExtensionMethod` is true, the emitter transforms:

- `nums.Where(x => x > 0)` → `Enumerable.Where(nums, x => x > 0)`

See [Extension Methods](../reference/dotnet/extension-methods.md) for full documentation.

### 3.6 IrStatement

```typescript
type IrStatement =
  // Declarations
  | IrVariableDeclaration // const x = 10;
  | IrFunctionDeclaration // function f() {}
  | IrClassDeclaration // class User {}
  | IrInterfaceDeclaration // interface IUser {}
  | IrEnumDeclaration // enum Status {}
  | IrTypeAliasDeclaration // type UserId = number;
  // Control flow
  | IrExpressionStatement // console.log("hi");
  | IrReturnStatement // return x;
  | IrIfStatement // if (x) {} else {}
  | IrWhileStatement // while (x) {}
  | IrForStatement // for (;;) {}
  | IrForOfStatement // for (const item of arr) {}
  | IrSwitchStatement // switch (x) { ... }
  | IrThrowStatement // throw new Error();
  | IrTryStatement // try {} catch {} finally {}
  | IrBlockStatement // { ... }
  | IrBreakStatement // break;
  | IrContinueStatement // continue;
  | IrEmptyStatement; // ;
```

---

## 4. IR Building Algorithm

### 4.1 Main Orchestrator

```typescript
const buildIrModule = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  options: IrBuildOptions
): Result<IrModule, Diagnostic> => {
  // 1. Set registries for binding resolution
  setMetadataRegistry(program.metadata);
  setBindingRegistry(program.bindings);

  // 2. Determine namespace and class name
  const namespace = getNamespaceFromPath(
    sourceFile.fileName,
    options.sourceRoot,
    options.rootNamespace
  );
  const className = getClassNameFromPath(sourceFile.fileName);

  // 3. Extract imports, exports, statements
  const imports = extractImports(sourceFile);
  const exports = extractExports(sourceFile, program.checker);
  const statements = extractStatements(sourceFile, program.checker);

  // 4. Check for file name / export name collision (TSN2003)
  const collisionExport = exports.find((exp) => {
    if (exp.kind === "declaration") {
      const decl = exp.declaration;
      // Functions and variables cannot match file name
      if (decl.kind === "functionDeclaration") {
        return decl.name === className;
      }
      if (decl.kind === "variableDeclaration") {
        return decl.declarations.some(
          (declarator) =>
            declarator.name.kind === "identifierPattern" &&
            declarator.name.name === className
        );
      }
    }
    return false;
  });

  if (collisionExport) {
    return error(
      createDiagnostic(
        "TSN2003",
        "error",
        `File name '${className}' conflicts with exported member name`,
        { file: sourceFile.fileName, line: 1, column: 1 }
      )
    );
  }

  // 5. Determine if static container
  const hasClassMatchingFilename = statements.some(
    (stmt) => stmt.kind === "classDeclaration" && stmt.name === className
  );
  const hasTopLevelCode = statements.some(isExecutableStatement);
  const isStaticContainer =
    !hasClassMatchingFilename && !hasTopLevelCode && exports.length > 0;

  // 6. Build IR module
  const module: IrModule = {
    kind: "module",
    filePath: sourceFile.fileName,
    namespace,
    className,
    isStaticContainer,
    imports,
    body: statements,
    exports,
  };

  return ok(module);
};
```

### 4.2 Import Extraction

```typescript
const extractImports = (sourceFile: ts.SourceFile): readonly IrImport[] => {
  const imports: IrImport[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;

    const moduleSpecifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) continue;

    const source = moduleSpecifier.text;
    const isLocal = source.startsWith(".") || source.startsWith("/");
    const isDotNet = !isLocal && /^[A-Z]/.test(source);

    const specifiers = extractImportSpecifiers(statement);

    imports.push({
      kind: "import",
      source,
      isLocal,
      isDotNet,
      specifiers,
      // Resolution happens in Phase 2, not here
    });
  }

  return imports;
};

const extractImportSpecifiers = (
  statement: ts.ImportDeclaration
): readonly IrImportSpecifier[] => {
  const specifiers: IrImportSpecifier[] = [];
  const clause = statement.importClause;

  if (!clause) return specifiers;

  // Default import: import User from "./User.ts"
  if (clause.name) {
    specifiers.push({
      kind: "default",
      localName: clause.name.text,
    });
  }

  // Named bindings
  if (clause.namedBindings) {
    // Namespace import: import * as fs from "fs"
    if (ts.isNamespaceImport(clause.namedBindings)) {
      specifiers.push({
        kind: "namespace",
        localName: clause.namedBindings.name.text,
      });
    }
    // Named imports: import { File, Directory } from "System.IO"
    else if (ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        specifiers.push({
          kind: "named",
          name: element.propertyName?.text ?? element.name.text,
          localName: element.name.text,
        });
      }
    }
  }

  return specifiers;
};
```

### 4.3 Export Extraction

```typescript
const extractExports = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): readonly IrExport[] => {
  const exports: IrExport[] = [];

  for (const statement of sourceFile.statements) {
    // Export declaration: export function foo() {}
    if (hasExportModifier(statement)) {
      const decl = convertStatement(statement, checker);
      if (decl) {
        exports.push({
          kind: "declaration",
          declaration: decl,
        });
      }
    }

    // Named export: export { x, y as z };
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          exports.push({
            kind: "named",
            name: element.propertyName?.text ?? element.name.text,
            localName: element.name.text,
          });
        }
      }
    }

    // Default export: export default x;
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const expr = convertExpression(statement.expression, checker);
      exports.push({
        kind: "default",
        expression: expr,
      });
    }
  }

  return exports;
};
```

### 4.4 Statement Extraction

```typescript
const extractStatements = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): readonly IrStatement[] => {
  const statements: IrStatement[] = [];

  for (const statement of sourceFile.statements) {
    // Skip imports and exports (handled separately)
    if (
      ts.isImportDeclaration(statement) ||
      ts.isExportDeclaration(statement) ||
      ts.isExportAssignment(statement)
    ) {
      continue;
    }

    // Convert statement
    const irStmt = convertStatement(statement, checker);
    if (irStmt) {
      statements.push(irStmt);
    }
  }

  return statements;
};

const isExecutableStatement = (stmt: IrStatement): boolean => {
  // Declarations are not executable
  if (
    stmt.kind === "functionDeclaration" ||
    stmt.kind === "classDeclaration" ||
    stmt.kind === "interfaceDeclaration" ||
    stmt.kind === "enumDeclaration" ||
    stmt.kind === "typeAliasDeclaration"
  ) {
    return false;
  }

  // Variable declarations with initializers are executable
  if (stmt.kind === "variableDeclaration") {
    return stmt.declarations.some((decl) => decl.init !== undefined);
  }

  // All other statements are executable
  return true;
};
```

---

## 5. Type Conversion

### 5.1 Main Type Converter

```typescript
const convertType = (
  typeNode: ts.TypeNode,
  checker: ts.TypeChecker
): IrType => {
  // Type references (User, Array<T>, etc.)
  if (ts.isTypeReferenceNode(typeNode)) {
    return convertTypeReference(typeNode, checker, convertType);
  }

  // Primitive keywords (string, number, boolean)
  const primitiveType = convertPrimitiveKeyword(typeNode.kind);
  if (primitiveType) {
    return primitiveType;
  }

  // Array types (T[])
  if (ts.isArrayTypeNode(typeNode)) {
    return convertArrayType(typeNode, checker, convertType);
  }

  // Function types ((x: number) => string)
  if (ts.isFunctionTypeNode(typeNode)) {
    return convertFunctionType(typeNode, checker, convertType);
  }

  // Object types ({ id: number; name: string })
  if (ts.isTypeLiteralNode(typeNode)) {
    return convertObjectType(typeNode, checker, convertType);
  }

  // Union types (string | number)
  if (ts.isUnionTypeNode(typeNode)) {
    return convertUnionType(typeNode, checker, convertType);
  }

  // Intersection types (User & Timestamped)
  if (ts.isIntersectionTypeNode(typeNode)) {
    return convertIntersectionType(typeNode, checker, convertType);
  }

  // Literal types ("pending", 42, true)
  if (ts.isLiteralTypeNode(typeNode)) {
    return convertLiteralType(typeNode);
  }

  // Parenthesized types
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return convertType(typeNode.type, checker);
  }

  // Default to any for unsupported types
  return { kind: "anyType" };
};
```

### 5.2 Primitive Type Conversion

```typescript
const convertPrimitiveKeyword = (
  kind: ts.SyntaxKind
): IrPrimitiveType | null => {
  switch (kind) {
    case ts.SyntaxKind.StringKeyword:
      return { kind: "primitiveType", name: "string" };
    case ts.SyntaxKind.NumberKeyword:
      return { kind: "primitiveType", name: "number" };
    case ts.SyntaxKind.BooleanKeyword:
      return { kind: "primitiveType", name: "boolean" };
    case ts.SyntaxKind.NullKeyword:
      return { kind: "primitiveType", name: "null" };
    case ts.SyntaxKind.UndefinedKeyword:
      return { kind: "primitiveType", name: "undefined" };
    case ts.SyntaxKind.VoidKeyword:
      return { kind: "voidType" };
    case ts.SyntaxKind.AnyKeyword:
      return { kind: "anyType" };
    case ts.SyntaxKind.UnknownKeyword:
      return { kind: "unknownType" };
    case ts.SyntaxKind.NeverKeyword:
      return { kind: "neverType" };
    default:
      return null;
  }
};
```

### 5.3 Type Reference Conversion

```typescript
const convertTypeReference = (
  node: ts.TypeReferenceNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType => {
  const typeName = node.typeName.getText();

  // Convert type arguments if present
  const typeArguments = node.typeArguments
    ? node.typeArguments.map((arg) => convertType(arg, checker))
    : undefined;

  return {
    kind: "referenceType",
    name: typeName,
    typeArguments,
  };
};
```

### 5.4 Array Type Conversion

```typescript
const convertArrayType = (
  node: ts.ArrayTypeNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrArrayType => {
  return {
    kind: "arrayType",
    elementType: convertType(node.elementType, checker),
  };
};
```

### 5.5 Function Type Conversion

```typescript
const convertFunctionType = (
  node: ts.FunctionTypeNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrFunctionType => {
  const parameters = node.parameters.map((param) => ({
    name: param.name.getText(),
    type: param.type
      ? convertType(param.type, checker)
      : { kind: "anyType" as const },
    optional: !!param.questionToken,
    rest: !!param.dotDotDotToken,
  }));

  const returnType = convertType(node.type, checker);

  return {
    kind: "functionType",
    parameters,
    returnType,
  };
};
```

---

## 6. Expression Conversion

### 6.1 Main Expression Dispatcher

```typescript
const convertExpression = (
  node: ts.Expression,
  checker: ts.TypeChecker
): IrExpression => {
  const inferredType = getInferredType(node, checker);

  // Literals
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return convertLiteral(node, checker);
  }
  if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return {
      kind: "literal",
      value: node.kind === ts.SyntaxKind.TrueKeyword,
      raw: node.getText(),
      inferredType,
    };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "literal", value: null, raw: "null", inferredType };
  }

  // Identifiers
  if (ts.isIdentifier(node)) {
    const binding = getBindingRegistry().getBinding(node.text);
    if (binding && binding.kind === "global") {
      return {
        kind: "identifier",
        name: node.text,
        inferredType,
        resolvedClrType: binding.type,
        resolvedAssembly: binding.assembly,
        csharpName: binding.csharpName,
      };
    }
    return { kind: "identifier", name: node.text, inferredType };
  }

  // Collections
  if (ts.isArrayLiteralExpression(node)) {
    return convertArrayLiteral(node, checker);
  }
  if (ts.isObjectLiteralExpression(node)) {
    return convertObjectLiteral(node, checker);
  }

  // Member access
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    return convertMemberExpression(node, checker);
  }

  // Calls
  if (ts.isCallExpression(node)) {
    return convertCallExpression(node, checker);
  }
  if (ts.isNewExpression(node)) {
    return convertNewExpression(node, checker);
  }

  // Operators
  if (ts.isBinaryExpression(node)) {
    return convertBinaryExpression(node, checker);
  }
  if (ts.isPrefixUnaryExpression(node)) {
    return convertUnaryExpression(node, checker);
  }
  if (ts.isPostfixUnaryExpression(node)) {
    return convertUpdateExpression(node, checker);
  }

  // Functions
  if (ts.isFunctionExpression(node)) {
    return convertFunctionExpression(node, checker);
  }
  if (ts.isArrowFunction(node)) {
    return convertArrowFunction(node, checker);
  }

  // Other
  if (ts.isConditionalExpression(node)) {
    return convertConditionalExpression(node, checker);
  }
  if (
    ts.isTemplateExpression(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return convertTemplateLiteral(node, checker);
  }

  // Default
  return { kind: "identifier", name: node.getText(), inferredType };
};
```

### 6.2 Type Inference

```typescript
const getInferredType = (
  node: ts.Node,
  checker: ts.TypeChecker
): IrType | undefined => {
  const tsType = checker.getTypeAtLocation(node);
  if (!tsType) return undefined;

  return convertTypeFromTsType(tsType, checker);
};

const convertTypeFromTsType = (
  tsType: ts.Type,
  checker: ts.TypeChecker
): IrType => {
  // Primitive types
  if (tsType.flags & ts.TypeFlags.String) {
    return { kind: "primitiveType", name: "string" };
  }
  if (tsType.flags & ts.TypeFlags.Number) {
    return { kind: "primitiveType", name: "number" };
  }
  if (tsType.flags & ts.TypeFlags.Boolean) {
    return { kind: "primitiveType", name: "boolean" };
  }
  if (tsType.flags & ts.TypeFlags.Null) {
    return { kind: "primitiveType", name: "null" };
  }
  if (tsType.flags & ts.TypeFlags.Undefined) {
    return { kind: "primitiveType", name: "undefined" };
  }

  // Object types
  if (tsType.flags & ts.TypeFlags.Object) {
    const symbol = tsType.getSymbol();
    if (symbol) {
      return {
        kind: "referenceType",
        name: symbol.getName(),
      };
    }
  }

  // Default to any
  return { kind: "anyType" };
};
```

### 6.3 Binding Resolution

```typescript
// Global variable binding (console, Math, etc.)
const resolveIdentifierBinding = (
  name: string
): {
  resolvedClrType?: string;
  resolvedAssembly?: string;
  csharpName?: string;
} => {
  const binding = getBindingRegistry().getBinding(name);

  if (!binding) {
    return {};
  }

  if (binding.kind === "global") {
    return {
      resolvedClrType: binding.type,
      resolvedAssembly: binding.assembly,
      csharpName: binding.csharpName,
    };
  }

  return {};
};

// Member binding (systemLinq.enumerable.selectMany)
const resolveMemberBinding = (
  object: IrExpression,
  property: string
):
  | {
      assembly?: string;
      type?: string;
      member?: string;
    }
  | undefined => {
  // Only resolve if object is an identifier
  if (object.kind !== "identifier") {
    return undefined;
  }

  // Get namespace binding
  const nsBinding = getBindingRegistry().getNamespace(object.name);
  if (!nsBinding) {
    return undefined;
  }

  // Look for type in namespace
  const typeBinding = nsBinding.types.find((t) => t.alias === property);
  if (typeBinding) {
    return {
      assembly: nsBinding.assembly,
      type: `${nsBinding.name}.${typeBinding.name}`,
      member: property,
    };
  }

  return undefined;
};
```

---

## 7. Statement Conversion

### 7.1 Variable Declaration

```typescript
const convertVariableStatement = (
  node: ts.VariableStatement,
  checker: ts.TypeChecker
): IrVariableDeclaration => {
  const declarations = node.declarationList.declarations.map((decl) => ({
    name: convertPattern(decl.name, checker),
    type: decl.type ? convertType(decl.type, checker) : undefined,
    init: decl.initializer
      ? convertExpression(decl.initializer, checker)
      : undefined,
  }));

  return {
    kind: "variableDeclaration",
    kind: node.declarationList.flags & ts.NodeFlags.Const ? "const" : "let",
    declarations,
  };
};
```

### 7.2 Function Declaration

```typescript
const convertFunctionDeclaration = (
  node: ts.FunctionDeclaration,
  checker: ts.TypeChecker
): IrFunctionDeclaration | null => {
  if (!node.name) return null;

  const parameters = convertParameters(node.parameters, checker);
  const returnType = node.type ? convertType(node.type, checker) : undefined;
  const body = node.body
    ? convertBlockStatement(node.body, checker)
    : undefined;

  return {
    kind: "functionDeclaration",
    name: node.name.text,
    parameters,
    returnType,
    body,
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    isGenerator: !!node.asteriskToken,
    typeParameters: node.typeParameters
      ? node.typeParameters.map((tp) => ({
          name: tp.name.text,
          constraint: tp.constraint
            ? convertType(tp.constraint, checker)
            : undefined,
          default: tp.default ? convertType(tp.default, checker) : undefined,
        }))
      : undefined,
  };
};
```

### 7.3 Class Declaration

```typescript
const convertClassDeclaration = (
  node: ts.ClassDeclaration,
  checker: ts.TypeChecker
): IrClassDeclaration | null => {
  if (!node.name) return null;

  const members: IrClassMember[] = [];

  for (const member of node.members) {
    if (ts.isPropertyDeclaration(member)) {
      members.push(convertPropertyDeclaration(member, checker));
    } else if (ts.isMethodDeclaration(member)) {
      members.push(convertMethodDeclaration(member, checker));
    } else if (ts.isConstructorDeclaration(member)) {
      members.push(convertConstructorDeclaration(member, checker));
    }
  }

  return {
    kind: "classDeclaration",
    name: node.name.text,
    members,
    extends: node.heritageClauses
      ?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
      ?.types[0]?.expression.getText(),
    implements: node.heritageClauses
      ?.find((clause) => clause.token === ts.SyntaxKind.ImplementsKeyword)
      ?.types.map((t) => t.expression.getText()),
    typeParameters: node.typeParameters
      ? node.typeParameters.map((tp) => ({
          name: tp.name.text,
          constraint: tp.constraint
            ? convertType(tp.constraint, checker)
            : undefined,
        }))
      : undefined,
  };
};
```

### 7.4 Control Flow Statements

```typescript
const convertIfStatement = (
  node: ts.IfStatement,
  checker: ts.TypeChecker
): IrIfStatement => {
  return {
    kind: "ifStatement",
    test: convertExpression(node.expression, checker),
    consequent: convertStatement(node.thenStatement, checker) as IrStatement,
    alternate: node.elseStatement
      ? (convertStatement(node.elseStatement, checker) as IrStatement)
      : undefined,
  };
};

const convertWhileStatement = (
  node: ts.WhileStatement,
  checker: ts.TypeChecker
): IrWhileStatement => {
  return {
    kind: "whileStatement",
    test: convertExpression(node.expression, checker),
    body: convertStatement(node.statement, checker) as IrStatement,
  };
};

const convertForOfStatement = (
  node: ts.ForOfStatement,
  checker: ts.TypeChecker
): IrForOfStatement => {
  return {
    kind: "forOfStatement",
    left: convertPattern(node.initializer, checker),
    right: convertExpression(node.expression, checker),
    body: convertStatement(node.statement, checker) as IrStatement,
    await: !!node.awaitModifier,
  };
};
```

---

## 8. Special Cases

### 8.1 Static Container Detection

A module is a **static container** when:

- It does NOT have a class matching the file name
- It does NOT have top-level executable code
- It DOES have exports

```typescript
// models/User.ts - NOT a static container (has class matching filename)
export class User {
  id: number;
  name: string;
}

// utils/helpers.ts - IS a static container (only exports functions)
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function pluralize(s: string): string {
  return s + "s";
}

// main.ts - NOT a static container (has top-level code)
import { User } from "./models/User.ts";

const user = new User();
console.log(user);
```

**C# Generation:**

```csharp
// models/User.ts → MyApp.models.User
namespace MyApp.models
{
  public class User
  {
    public double id;
    public string name;
  }
}

// utils/helpers.ts → MyApp.utils.helpers (static class)
namespace MyApp.utils
{
  public static class helpers
  {
    public static string capitalize(string s)
    {
      return s[0].ToUpper() + s.Substring(1);
    }

    public static string pluralize(string s)
    {
      return s + "s";
    }
  }
}

// main.ts → MyApp.main (has Main() entry point)
namespace MyApp
{
  public class main
  {
    public static void Main(string[] args)
    {
      var user = new models.User();
      Tsonic.Runtime.console.log(user);
    }
  }
}
```

### 8.2 File Name vs Export Name Collision

**Problem:** C# does not allow a member with the same name as the enclosing type.

```typescript
// main.ts
export function main(): void {
  console.log("Hello");
}
```

**Error:** TSN2003

```
File name 'main' conflicts with exported member name. In C#, a type cannot
contain a member with the same name as the enclosing type. Consider renaming
the file or the exported member.
```

**Solution:**

```typescript
// Option 1: Rename file
// app.ts
export function main(): void {
  console.log("Hello");
}

// Option 2: Rename function
// main.ts
export function runApp(): void {
  console.log("Hello");
}
```

### 8.3 Hierarchical Member Binding

TypeScript code can reference .NET APIs through hierarchical bindings:

```typescript
// TypeScript
import { systemLinq } from "System.Linq";

const result = systemLinq.enumerable.selectMany(arr, (x) => x.items);
```

**Binding Resolution:**

```json
{
  "namespaces": [
    {
      "name": "System.Linq",
      "alias": "systemLinq",
      "types": [
        {
          "name": "Enumerable",
          "alias": "enumerable",
          "members": [
            {
              "name": "SelectMany",
              "alias": "selectMany",
              "binding": {
                "assembly": "System.Linq",
                "type": "System.Linq.Enumerable",
                "member": "SelectMany"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**IR:**

```typescript
{
  kind: "call",
  callee: {
    kind: "memberAccess",
    object: {
      kind: "memberAccess",
      object: {
        kind: "identifier",
        name: "systemLinq",
      },
      property: "enumerable",
    },
    property: "selectMany",
    memberBinding: {
      assembly: "System.Linq",
      type: "System.Linq.Enumerable",
      member: "SelectMany",
    },
  },
  arguments: [
    { kind: "identifier", name: "arr" },
    { kind: "arrowFunction", /* ... */ },
  ],
}
```

**C# Output:**

```csharp
var result = System.Linq.Enumerable.SelectMany(arr, (x) => x.items);
```

---

## 9. Error Handling

### 9.1 Common Errors

**TSN6001: IR Build Failed**

```typescript
// Catch-all for unexpected errors during IR building
return error(
  createDiagnostic("TSN6001", "error", `Failed to build IR: ${err.message}`, {
    file: sourceFile.fileName,
    line: 1,
    column: 1,
  })
);
```

**TSN2003: Name Collision**

```typescript
// File name conflicts with export
File name 'main' conflicts with exported member name 'main'
```

---

## 10. Performance Characteristics

### 10.1 Complexity

**Import/Export Extraction:**

- Time: O(N) where N = statements in file
- Space: O(I + E) where I = imports, E = exports

**Statement Conversion:**

- Time: O(N) where N = AST nodes
- Space: O(N) for IR nodes

**Type Conversion:**

- Time: O(T) where T = type annotations
- Space: O(T) for IR types

**Expression Conversion:**

- Time: O(E) where E = expressions
- Space: O(E) for IR expressions

**Total Complexity:** O(N) for N = total AST nodes

### 10.2 Timing

**Small Project (10 files, 100 LOC each):**

- Import extraction: ~5ms
- Export extraction: ~5ms
- Statement conversion: ~30ms
- Type inference: ~20ms
- Expression conversion: ~40ms
- **Total: ~100ms**

**Medium Project (100 files, 200 LOC each):**

- Import extraction: ~20ms
- Export extraction: ~20ms
- Statement conversion: ~200ms
- Type inference: ~100ms
- Expression conversion: ~300ms
- **Total: ~640ms**

**Large Project (1000 files, 500 LOC each):**

- Import extraction: ~100ms
- Export extraction: ~100ms
- Statement conversion: ~2000ms
- Type inference: ~1000ms
- Expression conversion: ~3000ms
- **Total: ~6200ms**

### 10.3 Memory Usage

- IR nodes: ~500 bytes per node
- Type information: ~200 bytes per type
- Binding resolution: ~100 bytes per binding

**Medium project:** ~80 MB IR data

---

## 11. See Also

- [00-overview.md](00-overview.md) - System architecture
- [01-pipeline-flow.md](01-pipeline-flow.md) - Phase connections
- [02-phase-program.md](02-phase-program.md) - TypeScript program creation (previous phase)
- [06-phase-analysis.md](06-phase-analysis.md) - Dependency analysis (next phase)
- [07-phase-emitter.md](07-phase-emitter.md) - C# code generation
- [metadata.md](../metadata.md) - Metadata schema
- [bindings.md](../bindings.md) - Binding schema

---

**Document Statistics:**

- Lines: ~1,050
- Sections: 11
- Code examples: 35+
- Coverage: Complete IR building phase with type inference and binding resolution
