/**
 * Statement types for IR
 */

import { IrType, IrAttribute } from "./ir-types.js";
import {
  IrPattern,
  IrParameter,
  IrTypeParameter,
  IrAccessibility,
  IrInterfaceMember,
} from "./helpers.js";
import { IrExpression } from "./expressions.js";

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
  | IrForInStatement
  | IrSwitchStatement
  | IrThrowStatement
  | IrTryStatement
  | IrBlockStatement
  | IrBreakStatement
  | IrContinueStatement
  | IrEmptyStatement
  | IrYieldStatement
  | IrGeneratorReturnStatement;

export type IrVariableDeclaration = {
  readonly kind: "variableDeclaration";
  readonly declarationKind: "const" | "let" | "var";
  readonly declarations: readonly IrVariableDeclarator[];
  readonly isExported: boolean;
};

export type IrVariableDeclarator = {
  readonly kind: "variableDeclarator";
  readonly name: IrPattern;
  /** Type from annotation or inferred. Always set for module-level exports (C# requires explicit type). */
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
  /** C# attributes to emit before the function declaration */
  readonly attributes?: readonly IrAttribute[];
};

export type IrClassDeclaration = {
  readonly kind: "classDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  /** Base class type from `extends` clause (type-level, not expression-level). */
  readonly superClass?: IrType;
  readonly implements: readonly IrType[];
  readonly members: readonly IrClassMember[];
  readonly isExported: boolean;
  /** True if this class should be emitted as a C# struct instead of a class */
  readonly isStruct: boolean;
  /** C# attributes to emit before the class declaration */
  readonly attributes?: readonly IrAttribute[];
  /**
   * C# attributes to emit before ALL constructors on this class.
   *
   * Used by the compiler-only attribute API: `A.on(Class).ctor.add(...)`.
   * These attributes are applied to:
   * - an explicit TS constructor (if present)
   * - synthesized forwarding constructors (when needed for base ctor forwarding)
   * - a synthesized parameterless constructor (when no ctor exists but ctor attributes are requested)
   */
  readonly ctorAttributes?: readonly IrAttribute[];
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
  /** True if this method should be emitted as virtual (overridden in derived class) */
  readonly isVirtual?: boolean;
  /** C# attributes to emit before the method declaration */
  readonly attributes?: readonly IrAttribute[];
};

export type IrPropertyDeclaration = {
  readonly kind: "propertyDeclaration";
  readonly name: string;
  /** Type from annotation or inferred. Always set for class fields (C# requires explicit type). */
  readonly type?: IrType;
  readonly initializer?: IrExpression;
  /**
   * Emit as an auto-property (`{ get; set; }`) even when no accessor bodies are present.
   *
   * By default, property declarations without accessors are emitted as C# fields
   * to match TypeScript class field semantics. Synthetic DTO-like declarations
   * (e.g., anonymous type lowering) set this flag so they interop cleanly with
   * reflection-based libraries like System.Text.Json.
   */
  readonly emitAsAutoProperty?: boolean;
  /** Getter body for accessor properties (`get foo() { ... }`). */
  readonly getterBody?: IrBlockStatement;
  /**
   * Setter body for accessor properties (`set foo(v) { ... }`).
   * The implicit C# setter parameter is named `value`; use setterParamName to bridge naming.
   */
  readonly setterBody?: IrBlockStatement;
  /** Original TypeScript parameter name for setter body, if present. */
  readonly setterParamName?: string;
  readonly isStatic: boolean;
  readonly isReadonly: boolean;
  readonly accessibility: IrAccessibility;
  /** True if this property overrides a virtual base class property (from metadata or TS base class) */
  readonly isOverride?: boolean;
  /** True if this property shadows a non-virtual base property (future: emit 'new' keyword) */
  readonly isShadow?: boolean;
  /** C# attributes to emit before the property declaration */
  readonly attributes?: readonly IrAttribute[];
  /** True if property must be set in object initializer (C# 11 'required' modifier) */
  readonly isRequired?: boolean;
};

export type IrConstructorDeclaration = {
  readonly kind: "constructorDeclaration";
  readonly parameters: readonly IrParameter[];
  readonly body?: IrBlockStatement;
  readonly accessibility: IrAccessibility;
  /** C# attributes to emit before the constructor declaration */
  readonly attributes?: readonly IrAttribute[];
};

export type IrInterfaceDeclaration = {
  readonly kind: "interfaceDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly extends: readonly IrType[];
  readonly members: readonly IrInterfaceMember[];
  readonly isExported: boolean;
  /** True if this interface should be emitted as a C# struct instead of a class */
  readonly isStruct: boolean;
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
  /** True if this type alias should be emitted as a C# struct instead of a class */
  readonly isStruct: boolean;
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
  /** True for `for await (... of ...)` - async iteration */
  readonly isAwait: boolean;
};

export type IrForInStatement = {
  readonly kind: "forInStatement";
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

/**
 * Lowered yield statement for bidirectional generators.
 * Created by yield-lowering pass from IrYieldExpression patterns:
 * - `yield expr;` → receiveTarget undefined
 * - `const x = yield expr;` → receiveTarget = identifierPattern("x")
 * - `x = yield expr;` → receiveTarget = identifierPattern("x")
 * - `const {a, b} = yield expr;` → receiveTarget = objectPattern(...)
 */
export type IrYieldStatement = {
  readonly kind: "yieldStatement";
  /** Value to yield (maps to exchange.Output) */
  readonly output?: IrExpression;
  /** True for yield*, false for yield */
  readonly delegate: boolean;
  /** Where to assign received Input value after resumption */
  readonly receiveTarget?: IrPattern;
  /** Type of the received value (from Generator<Y, R, TNext>) */
  readonly receivedType?: IrType;
};

/**
 * Lowered return statement for generators with TReturn.
 * Created by yield-lowering pass from `return expr;` statements.
 *
 * In generators, `return expr;` is transformed to:
 * - Set __returnValue = expr (captured in closure)
 * - Emit yield break; to terminate iteration
 *
 * This allows the wrapper's next() method to return the final value
 * via the _getReturnValue closure when iteration completes.
 */
export type IrGeneratorReturnStatement = {
  readonly kind: "generatorReturnStatement";
  /** Expression to capture as the generator's return value */
  readonly expression?: IrExpression;
};
