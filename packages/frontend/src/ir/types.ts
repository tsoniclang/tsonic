/**
 * Intermediate Representation (IR) types for Tsonic compiler
 * Simplified, focused IR for TypeScript to C# compilation
 */

// ============================================================================
// Core IR Types
// ============================================================================

export type IrModule = {
  readonly kind: "module";
  readonly filePath: string;
  readonly namespace: string;
  readonly className: string; // File name becomes class name
  readonly isStaticContainer: boolean; // True if module only has exports, no top-level code
  readonly imports: readonly IrImport[];
  readonly body: readonly IrStatement[];
  readonly exports: readonly IrExport[];
};

export type IrImport = {
  readonly kind: "import";
  readonly source: string; // Import path
  readonly isLocal: boolean;
  readonly isDotNet: boolean;
  readonly specifiers: readonly IrImportSpecifier[];
  readonly resolvedNamespace?: string; // For .NET imports
};

export type IrImportSpecifier =
  | { readonly kind: "default"; readonly localName: string }
  | { readonly kind: "namespace"; readonly localName: string }
  | {
      readonly kind: "named";
      readonly name: string;
      readonly localName: string;
    };

export type IrExport =
  | {
      readonly kind: "named";
      readonly name: string;
      readonly localName: string;
    }
  | { readonly kind: "default"; readonly expression: IrExpression }
  | { readonly kind: "declaration"; readonly declaration: IrStatement };

// ============================================================================
// Statements
// ============================================================================

export type IrStatement =
  | IrVariableDeclaration
  | IrFunctionDeclaration
  | IrClassDeclaration
  | IrInterfaceDeclaration
  | IrEnumDeclaration
  | IrTypeAliasDeclaration
  | IrExpressionStatement
  | IrReturnStatement
  | IrIfStatement
  | IrWhileStatement
  | IrForStatement
  | IrForOfStatement
  | IrSwitchStatement
  | IrThrowStatement
  | IrTryStatement
  | IrBlockStatement
  | IrBreakStatement
  | IrContinueStatement
  | IrEmptyStatement;

export type IrVariableDeclaration = {
  readonly kind: "variableDeclaration";
  readonly declarationKind: "const" | "let" | "var";
  readonly declarations: readonly IrVariableDeclarator[];
  readonly isExported: boolean;
};

export type IrVariableDeclarator = {
  readonly kind: "variableDeclarator";
  readonly name: IrPattern;
  readonly type?: IrType;
  readonly initializer?: IrExpression;
};

export type IrFunctionDeclaration = {
  readonly kind: "functionDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
  readonly body: IrBlockStatement;
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
  readonly isExported: boolean;
};

export type IrClassDeclaration = {
  readonly kind: "classDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly superClass?: IrExpression;
  readonly implements: readonly IrType[];
  readonly members: readonly IrClassMember[];
  readonly isExported: boolean;
};

export type IrClassMember =
  | IrMethodDeclaration
  | IrPropertyDeclaration
  | IrConstructorDeclaration;

export type IrMethodDeclaration = {
  readonly kind: "methodDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
  readonly body?: IrBlockStatement;
  readonly isStatic: boolean;
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
  readonly accessibility: IrAccessibility;
  /** True if this method overrides a virtual base class method (from metadata or TS base class) */
  readonly isOverride?: boolean;
  /** True if this method shadows a non-virtual base method (future: emit 'new' keyword) */
  readonly isShadow?: boolean;
};

export type IrPropertyDeclaration = {
  readonly kind: "propertyDeclaration";
  readonly name: string;
  readonly type?: IrType;
  readonly initializer?: IrExpression;
  readonly isStatic: boolean;
  readonly isReadonly: boolean;
  readonly accessibility: IrAccessibility;
  /** True if this property overrides a virtual base class property (from metadata or TS base class) */
  readonly isOverride?: boolean;
  /** True if this property shadows a non-virtual base property (future: emit 'new' keyword) */
  readonly isShadow?: boolean;
};

export type IrConstructorDeclaration = {
  readonly kind: "constructorDeclaration";
  readonly parameters: readonly IrParameter[];
  readonly body?: IrBlockStatement;
  readonly accessibility: IrAccessibility;
};

export type IrInterfaceDeclaration = {
  readonly kind: "interfaceDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly extends: readonly IrType[];
  readonly members: readonly IrInterfaceMember[];
  readonly isExported: boolean;
};

export type IrInterfaceMember = IrPropertySignature | IrMethodSignature;

export type IrPropertySignature = {
  readonly kind: "propertySignature";
  readonly name: string;
  readonly type: IrType;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
};

export type IrMethodSignature = {
  readonly kind: "methodSignature";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
};

export type IrEnumDeclaration = {
  readonly kind: "enumDeclaration";
  readonly name: string;
  readonly members: readonly IrEnumMember[];
  readonly isExported: boolean;
};

export type IrEnumMember = {
  readonly kind: "enumMember";
  readonly name: string;
  readonly initializer?: IrExpression;
};

export type IrTypeAliasDeclaration = {
  readonly kind: "typeAliasDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly type: IrType;
  readonly isExported: boolean;
};

export type IrExpressionStatement = {
  readonly kind: "expressionStatement";
  readonly expression: IrExpression;
};

export type IrReturnStatement = {
  readonly kind: "returnStatement";
  readonly expression?: IrExpression;
};

export type IrIfStatement = {
  readonly kind: "ifStatement";
  readonly condition: IrExpression;
  readonly thenStatement: IrStatement;
  readonly elseStatement?: IrStatement;
};

export type IrWhileStatement = {
  readonly kind: "whileStatement";
  readonly condition: IrExpression;
  readonly body: IrStatement;
};

export type IrForStatement = {
  readonly kind: "forStatement";
  readonly initializer?: IrVariableDeclaration | IrExpression;
  readonly condition?: IrExpression;
  readonly update?: IrExpression;
  readonly body: IrStatement;
};

export type IrForOfStatement = {
  readonly kind: "forOfStatement";
  readonly variable: IrPattern;
  readonly expression: IrExpression;
  readonly body: IrStatement;
};

export type IrSwitchStatement = {
  readonly kind: "switchStatement";
  readonly expression: IrExpression;
  readonly cases: readonly IrSwitchCase[];
};

export type IrSwitchCase = {
  readonly kind: "switchCase";
  readonly test?: IrExpression; // undefined for default case
  readonly statements: readonly IrStatement[];
};

export type IrThrowStatement = {
  readonly kind: "throwStatement";
  readonly expression: IrExpression;
};

export type IrTryStatement = {
  readonly kind: "tryStatement";
  readonly tryBlock: IrBlockStatement;
  readonly catchClause?: IrCatchClause;
  readonly finallyBlock?: IrBlockStatement;
};

export type IrCatchClause = {
  readonly kind: "catchClause";
  readonly parameter?: IrPattern;
  readonly body: IrBlockStatement;
};

export type IrBlockStatement = {
  readonly kind: "blockStatement";
  readonly statements: readonly IrStatement[];
};

export type IrBreakStatement = {
  readonly kind: "breakStatement";
  readonly label?: string;
};

export type IrContinueStatement = {
  readonly kind: "continueStatement";
  readonly label?: string;
};

export type IrEmptyStatement = {
  readonly kind: "emptyStatement";
};

// ============================================================================
// Expressions
// ============================================================================

export type IrExpression =
  | IrLiteralExpression
  | IrIdentifierExpression
  | IrArrayExpression
  | IrObjectExpression
  | IrFunctionExpression
  | IrArrowFunctionExpression
  | IrMemberExpression
  | IrCallExpression
  | IrNewExpression
  | IrThisExpression
  | IrUpdateExpression
  | IrUnaryExpression
  | IrBinaryExpression
  | IrLogicalExpression
  | IrConditionalExpression
  | IrAssignmentExpression
  | IrTemplateLiteralExpression
  | IrSpreadExpression
  | IrAwaitExpression
  | IrYieldExpression;

export type IrLiteralExpression = {
  readonly kind: "literal";
  readonly value: string | number | boolean | null | undefined;
  readonly raw?: string;
  readonly inferredType?: IrType;
};

export type IrIdentifierExpression = {
  readonly kind: "identifier";
  readonly name: string;
  readonly inferredType?: IrType;
};

export type IrArrayExpression = {
  readonly kind: "array";
  readonly elements: readonly (IrExpression | IrSpreadExpression | undefined)[]; // undefined for holes
  readonly inferredType?: IrType;
};

export type IrObjectExpression = {
  readonly kind: "object";
  readonly properties: readonly IrObjectProperty[];
  readonly inferredType?: IrType;
};

export type IrObjectProperty =
  | {
      readonly kind: "property";
      readonly key: string | IrExpression;
      readonly value: IrExpression;
      readonly shorthand: boolean;
    }
  | { readonly kind: "spread"; readonly expression: IrExpression };

export type IrFunctionExpression = {
  readonly kind: "functionExpression";
  readonly name?: string;
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
  readonly body: IrBlockStatement;
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
  readonly inferredType?: IrType;
};

export type IrArrowFunctionExpression = {
  readonly kind: "arrowFunction";
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
  readonly body: IrBlockStatement | IrExpression;
  readonly isAsync: boolean;
  readonly inferredType?: IrType;
};

export type IrMemberExpression = {
  readonly kind: "memberAccess";
  readonly object: IrExpression;
  readonly property: IrExpression | string;
  readonly isComputed: boolean; // true for obj[prop], false for obj.prop
  readonly isOptional: boolean; // true for obj?.prop
  readonly inferredType?: IrType;
};

export type IrCallExpression = {
  readonly kind: "call";
  readonly callee: IrExpression;
  readonly arguments: readonly (IrExpression | IrSpreadExpression)[];
  readonly isOptional: boolean; // true for func?.()
  readonly inferredType?: IrType;
  readonly typeArguments?: readonly IrType[]; // Explicit or inferred type arguments
  readonly requiresSpecialization?: boolean; // Flag for conditional/unsupported patterns
};

export type IrNewExpression = {
  readonly kind: "new";
  readonly callee: IrExpression;
  readonly arguments: readonly (IrExpression | IrSpreadExpression)[];
  readonly inferredType?: IrType;
  readonly typeArguments?: readonly IrType[]; // Explicit or inferred type arguments
  readonly requiresSpecialization?: boolean; // Flag for conditional/unsupported patterns
};

export type IrThisExpression = {
  readonly kind: "this";
  readonly inferredType?: IrType;
};

export type IrUpdateExpression = {
  readonly kind: "update";
  readonly operator: "++" | "--";
  readonly prefix: boolean;
  readonly expression: IrExpression;
  readonly inferredType?: IrType;
};

export type IrUnaryExpression = {
  readonly kind: "unary";
  readonly operator: "+" | "-" | "!" | "~" | "typeof" | "void" | "delete";
  readonly expression: IrExpression;
  readonly inferredType?: IrType;
};

export type IrBinaryExpression = {
  readonly kind: "binary";
  readonly operator: IrBinaryOperator;
  readonly left: IrExpression;
  readonly right: IrExpression;
  readonly inferredType?: IrType;
};

export type IrLogicalExpression = {
  readonly kind: "logical";
  readonly operator: "&&" | "||" | "??";
  readonly left: IrExpression;
  readonly right: IrExpression;
  readonly inferredType?: IrType;
};

export type IrConditionalExpression = {
  readonly kind: "conditional";
  readonly condition: IrExpression;
  readonly whenTrue: IrExpression;
  readonly whenFalse: IrExpression;
  readonly inferredType?: IrType;
};

export type IrAssignmentExpression = {
  readonly kind: "assignment";
  readonly operator: IrAssignmentOperator;
  readonly left: IrExpression | IrPattern;
  readonly right: IrExpression;
  readonly inferredType?: IrType;
};

export type IrTemplateLiteralExpression = {
  readonly kind: "templateLiteral";
  readonly quasis: readonly string[];
  readonly expressions: readonly IrExpression[];
  readonly inferredType?: IrType;
};

export type IrSpreadExpression = {
  readonly kind: "spread";
  readonly expression: IrExpression;
  readonly inferredType?: IrType;
};

export type IrAwaitExpression = {
  readonly kind: "await";
  readonly expression: IrExpression;
  readonly inferredType?: IrType;
};

export type IrYieldExpression = {
  readonly kind: "yield";
  readonly expression?: IrExpression; // Optional for bare `yield`
  readonly delegate: boolean; // true for `yield*`, false for `yield`
  readonly inferredType?: IrType;
};

// ============================================================================
// Patterns (for destructuring)
// ============================================================================

export type IrPattern = IrIdentifierPattern | IrArrayPattern | IrObjectPattern;

export type IrIdentifierPattern = {
  readonly kind: "identifierPattern";
  readonly name: string;
  readonly type?: IrType;
};

export type IrArrayPattern = {
  readonly kind: "arrayPattern";
  readonly elements: readonly (IrPattern | undefined)[]; // undefined for holes
};

export type IrObjectPattern = {
  readonly kind: "objectPattern";
  readonly properties: readonly IrObjectPatternProperty[];
};

export type IrObjectPatternProperty =
  | {
      readonly kind: "property";
      readonly key: string;
      readonly value: IrPattern;
      readonly shorthand: boolean;
    }
  | { readonly kind: "rest"; readonly pattern: IrPattern };

// ============================================================================
// Types
// ============================================================================

export type IrType =
  | IrPrimitiveType
  | IrReferenceType
  | IrArrayType
  | IrFunctionType
  | IrObjectType
  | IrUnionType
  | IrIntersectionType
  | IrLiteralType
  | IrAnyType
  | IrUnknownType
  | IrVoidType
  | IrNeverType;

export type IrPrimitiveType = {
  readonly kind: "primitiveType";
  readonly name: "string" | "number" | "boolean" | "null" | "undefined";
};

export type IrReferenceType = {
  readonly kind: "referenceType";
  readonly name: string;
  readonly typeArguments?: readonly IrType[];
};

export type IrArrayType = {
  readonly kind: "arrayType";
  readonly elementType: IrType;
};

export type IrFunctionType = {
  readonly kind: "functionType";
  readonly parameters: readonly IrParameter[];
  readonly returnType: IrType;
};

export type IrObjectType = {
  readonly kind: "objectType";
  readonly members: readonly IrInterfaceMember[];
};

export type IrUnionType = {
  readonly kind: "unionType";
  readonly types: readonly IrType[];
};

export type IrIntersectionType = {
  readonly kind: "intersectionType";
  readonly types: readonly IrType[];
};

export type IrLiteralType = {
  readonly kind: "literalType";
  readonly value: string | number | boolean;
};

export type IrAnyType = {
  readonly kind: "anyType";
};

export type IrUnknownType = {
  readonly kind: "unknownType";
};

export type IrVoidType = {
  readonly kind: "voidType";
};

export type IrNeverType = {
  readonly kind: "neverType";
};

// ============================================================================
// Supporting Types
// ============================================================================

export type IrTypeParameter = {
  readonly kind: "typeParameter";
  readonly name: string;
  readonly constraint?: IrType; // Can reference other type parameters (enables recursion)
  readonly default?: IrType;
  readonly variance?: "in" | "out"; // For covariance/contravariance
  readonly isStructuralConstraint?: boolean; // Flag for { id: number } style constraints
  readonly structuralMembers?: readonly IrInterfaceMember[]; // Properties for structural constraints
};

export type IrParameter = {
  readonly kind: "parameter";
  readonly pattern: IrPattern;
  readonly type?: IrType;
  readonly initializer?: IrExpression;
  readonly isOptional: boolean;
  readonly isRest: boolean;
};

export type IrAccessibility = "public" | "private" | "protected";

export type IrBinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "**"
  | "=="
  | "!="
  | "==="
  | "!=="
  | "<"
  | ">"
  | "<="
  | ">="
  | "<<"
  | ">>"
  | ">>>"
  | "&"
  | "|"
  | "^"
  | "in"
  | "instanceof";

export type IrAssignmentOperator =
  | "="
  | "+="
  | "-="
  | "*="
  | "/="
  | "%="
  | "**="
  | "<<="
  | ">>="
  | ">>>="
  | "&="
  | "|="
  | "^="
  | "&&="
  | "||="
  | "??=";

// ============================================================================
// Helper Type Guards
// ============================================================================

export const isStatement = (
  node: IrStatement | IrExpression
): node is IrStatement => {
  const statementKinds: string[] = [
    "variableDeclaration",
    "functionDeclaration",
    "classDeclaration",
    "interfaceDeclaration",
    "enumDeclaration",
    "typeAliasDeclaration",
    "expressionStatement",
    "returnStatement",
    "ifStatement",
    "whileStatement",
    "forStatement",
    "forOfStatement",
    "switchStatement",
    "throwStatement",
    "tryStatement",
    "blockStatement",
    "breakStatement",
    "continueStatement",
    "emptyStatement",
  ];
  return statementKinds.includes(node.kind);
};

export const isExpression = (
  node: IrStatement | IrExpression
): node is IrExpression => {
  return !isStatement(node);
};
