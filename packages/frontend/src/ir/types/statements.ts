/**
 * Statement types for IR
 */

import { IrType } from "./ir-types.js";
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
};

export type IrClassDeclaration = {
  readonly kind: "classDeclaration";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly superClass?: IrExpression;
  readonly implements: readonly IrType[];
  readonly members: readonly IrClassMember[];
  readonly isExported: boolean;
  /** True if this class should be emitted as a C# struct instead of a class */
  readonly isStruct: boolean;
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
  /** Type from annotation or inferred. Always set for class fields (C# requires explicit type). */
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
