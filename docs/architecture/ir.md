# Intermediate Representation (IR)

The IR is the core data structure that bridges TypeScript and C#.

## Purpose

The IR provides:

- Language-independent representation
- Semantic preservation
- Optimization opportunities
- Clean separation between parsing and emission

## IrModule

Top-level structure representing a TypeScript file:

```typescript
type IrModule = {
  readonly filePath: string; // Relative path: "src/utils/math.ts"
  readonly namespace: string; // C# namespace: "MyApp.src.utils"
  readonly className: string; // C# class name: "math"
  readonly imports: readonly IrImport[];
  readonly exports: readonly IrExport[];
  readonly body: readonly IrStatement[];
};
```

## Imports

### IrImport

```typescript
type IrImport = {
  readonly kind: "import";
  readonly moduleSpecifier: string; // "./utils.ts" or "@tsonic/dotnet/System"
  readonly specifiers: readonly IrImportSpecifier[];
  readonly isTypeOnly: boolean;
  readonly resolved?: {
    readonly isLocal: boolean;
    readonly absolutePath?: string;
    readonly clrNamespace?: string;
  };
};

type IrImportSpecifier =
  | { kind: "named"; name: string; alias?: string }
  | { kind: "default"; alias: string }
  | { kind: "namespace"; alias: string };
```

## Exports

### IrExport

```typescript
type IrExport =
  | { kind: "declaration"; declaration: IrStatement }
  | { kind: "named"; name: string; alias?: string }
  | { kind: "reexport"; moduleSpecifier: string; specifiers: ... };
```

## Statements

### Variable Declaration

```typescript
type IrVariableDeclaration = {
  readonly kind: "variableDeclaration";
  readonly declarationKind: "const" | "let" | "var";
  readonly declarations: readonly IrVariableDeclarator[];
};

type IrVariableDeclarator = {
  readonly pattern: IrPattern;
  readonly type?: IrType;
  readonly init?: IrExpression;
};
```

### Function Declaration

```typescript
type IrFunctionDeclaration = {
  readonly kind: "functionDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
  readonly body?: IrBlockStatement;
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
  readonly isExported: boolean;
};
```

### Class Declaration

```typescript
type IrClassDeclaration = {
  readonly kind: "classDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly extends?: IrReferenceType;
  readonly implements?: readonly IrReferenceType[];
  readonly members: readonly IrClassMember[];
  readonly isExported: boolean;
  readonly isAbstract: boolean;
};

type IrClassMember =
  | IrPropertyDeclaration
  | IrMethodDeclaration
  | IrConstructorDeclaration;
```

### Interface Declaration

```typescript
type IrInterfaceDeclaration = {
  readonly kind: "interfaceDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly extends?: readonly IrReferenceType[];
  readonly members: readonly IrInterfaceMember[];
  readonly isExported: boolean;
};
```

### Control Flow

```typescript
type IrIfStatement = {
  readonly kind: "ifStatement";
  readonly test: IrExpression;
  readonly consequent: IrStatement;
  readonly alternate?: IrStatement;
};

type IrForStatement = {
  readonly kind: "forStatement";
  readonly init?: IrVariableDeclaration | IrExpression;
  readonly test?: IrExpression;
  readonly update?: IrExpression;
  readonly body: IrStatement;
};

type IrForOfStatement = {
  readonly kind: "forOfStatement";
  readonly left: IrVariableDeclaration | IrPattern;
  readonly right: IrExpression;
  readonly body: IrStatement;
  readonly isAwait: boolean;
};
```

## Expressions

### Literals

```typescript
type IrLiteralExpression = {
  readonly kind: "literal";
  readonly value: string | number | boolean | null;
  readonly raw: string;
};
```

### Identifiers

```typescript
type IrIdentifierExpression = {
  readonly kind: "identifier";
  readonly name: string;
  readonly type?: IrType;
};
```

### Binary Expressions

```typescript
type IrBinaryExpression = {
  readonly kind: "binary";
  readonly operator: IrBinaryOperator;
  readonly left: IrExpression;
  readonly right: IrExpression;
};

type IrBinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "=="
  | "!="
  | "==="
  | "!=="
  | "<"
  | ">"
  | "<="
  | ">="
  | "&&"
  | "||"
  | "??"
  | "&"
  | "|"
  | "^"
  | "<<"
  | ">>";
```

### Call Expressions

```typescript
type IrCallExpression = {
  readonly kind: "call";
  readonly callee: IrExpression;
  readonly typeArguments?: readonly IrType[];
  readonly arguments: readonly IrExpression[];
};
```

### Member Access

```typescript
type IrMemberExpression = {
  readonly kind: "member";
  readonly object: IrExpression;
  readonly property: string | IrExpression;
  readonly computed: boolean; // obj[prop] vs obj.prop
  readonly optional: boolean; // obj?.prop
};
```

### Object and Array Literals

```typescript
type IrArrayExpression = {
  readonly kind: "array";
  readonly elements: readonly (IrExpression | null)[]; // null = hole
};

type IrObjectExpression = {
  readonly kind: "object";
  readonly properties: readonly IrObjectProperty[];
};

type IrObjectProperty = {
  readonly key: string | IrExpression;
  readonly value: IrExpression;
  readonly computed: boolean;
  readonly shorthand: boolean;
  readonly method: boolean;
};
```

## Types

### Primitive Types

```typescript
type IrPrimitiveType = {
  readonly kind: "primitiveType";
  readonly name: "number" | "string" | "boolean" | "null" | "undefined";
};
```

### Reference Types

```typescript
type IrReferenceType = {
  readonly kind: "referenceType";
  readonly name: string;
  readonly typeArguments?: readonly IrType[];
  readonly clrType?: string; // e.g., "System.Collections.Generic.List"
};
```

### Array Types

```typescript
type IrArrayType = {
  readonly kind: "arrayType";
  readonly elementType: IrType;
};
```

### Function Types

```typescript
type IrFunctionType = {
  readonly kind: "functionType";
  readonly parameters: readonly IrParameter[];
  readonly returnType: IrType;
  readonly typeParameters?: readonly IrTypeParameter[];
};
```

### Union and Intersection

```typescript
type IrUnionType = {
  readonly kind: "unionType";
  readonly types: readonly IrType[];
};

type IrIntersectionType = {
  readonly kind: "intersectionType";
  readonly types: readonly IrType[];
};
```

## Patterns

Used in destructuring and parameters:

```typescript
type IrPattern = IrIdentifierPattern | IrArrayPattern | IrObjectPattern;

type IrIdentifierPattern = {
  readonly kind: "identifier";
  readonly name: string;
  readonly type?: IrType;
};

type IrArrayPattern = {
  readonly kind: "array";
  readonly elements: readonly (IrPattern | null)[];
  readonly rest?: IrPattern;
};

type IrObjectPattern = {
  readonly kind: "object";
  readonly properties: readonly IrObjectPatternProperty[];
  readonly rest?: IrPattern;
};
```

## Building IR

The IR is built by traversing the TypeScript AST:

```typescript
// Simplified flow
const buildIrModule = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): IrModule => {
  const body = sourceFile.statements.map((stmt) =>
    convertStatement(stmt, checker)
  );
  const imports = extractImports(sourceFile);
  const exports = extractExports(sourceFile, body);

  return {
    filePath: getRelativePath(sourceFile.fileName),
    namespace: computeNamespace(sourceFile.fileName),
    className: computeClassName(sourceFile.fileName),
    imports,
    exports,
    body,
  };
};
```
