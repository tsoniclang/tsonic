import type { CSharpExpressionAst } from "./expression-ast.js";
import type {
  CSharpAttributeAst,
  CSharpParameterAst,
  CSharpTypeParameterAst,
  CSharpTypeParameterConstraintAst,
} from "./signature-ast.js";
import type { CSharpBlockStatementAst } from "./statement-ast.js";
import type { CSharpTypeAst } from "./type-ast.js";

export type CSharpFieldDeclarationAst = {
  readonly kind: "fieldDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly type: CSharpTypeAst;
  readonly name: string;
  readonly initializer?: CSharpExpressionAst;
};

export type CSharpPropertyDeclarationAst = {
  readonly kind: "propertyDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly type: CSharpTypeAst;
  readonly name: string;
  readonly explicitInterface?: CSharpTypeAst;
  readonly hasGetter: boolean;
  readonly hasSetter: boolean;
  readonly setterAccessibility?: "private" | "protected" | "internal";
  /** C# 9 init-only setter (`{ get; init; }`) */
  readonly hasInit?: boolean;
  readonly initializer?: CSharpExpressionAst;
  readonly isAutoProperty: boolean;
  /** Explicit getter body (when isAutoProperty is false) */
  readonly getterBody?: CSharpBlockStatementAst;
  /** Explicit setter body (when isAutoProperty is false) */
  readonly setterBody?: CSharpBlockStatementAst;
};

export type CSharpMethodDeclarationAst = {
  readonly kind: "methodDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly returnType: CSharpTypeAst;
  readonly name: string;
  readonly explicitInterface?: CSharpTypeAst;
  readonly typeParameters?: readonly CSharpTypeParameterAst[];
  readonly parameters: readonly CSharpParameterAst[];
  readonly body?: CSharpBlockStatementAst;
  readonly expressionBody?: CSharpExpressionAst;
  readonly constraints?: readonly CSharpTypeParameterConstraintAst[];
};

export type CSharpConstructorDeclarationAst = {
  readonly kind: "constructorDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly parameters: readonly CSharpParameterAst[];
  readonly baseArguments?: readonly CSharpExpressionAst[];
  readonly body: CSharpBlockStatementAst;
};

export type CSharpEnumMemberAst = {
  readonly name: string;
  readonly value?: CSharpExpressionAst;
};

export type CSharpDelegateDeclarationAst = {
  readonly kind: "delegateDeclaration";
  readonly modifiers: readonly string[];
  readonly returnType: CSharpTypeAst;
  readonly name: string;
  readonly parameters: readonly CSharpParameterAst[];
};

export type CSharpMemberAst =
  | CSharpFieldDeclarationAst
  | CSharpPropertyDeclarationAst
  | CSharpMethodDeclarationAst
  | CSharpConstructorDeclarationAst
  | CSharpDelegateDeclarationAst;

export type CSharpClassDeclarationAst = {
  readonly kind: "classDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly typeParameters?: readonly CSharpTypeParameterAst[];
  readonly baseType?: CSharpTypeAst;
  readonly interfaces: readonly CSharpTypeAst[];
  readonly members: readonly CSharpMemberAst[];
  readonly constraints?: readonly CSharpTypeParameterConstraintAst[];
};

export type CSharpStructDeclarationAst = {
  readonly kind: "structDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly typeParameters?: readonly CSharpTypeParameterAst[];
  readonly interfaces: readonly CSharpTypeAst[];
  readonly members: readonly CSharpMemberAst[];
  readonly constraints?: readonly CSharpTypeParameterConstraintAst[];
};

export type CSharpInterfaceDeclarationAst = {
  readonly kind: "interfaceDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly typeParameters?: readonly CSharpTypeParameterAst[];
  readonly interfaces: readonly CSharpTypeAst[];
  readonly members: readonly CSharpMemberAst[];
  readonly constraints?: readonly CSharpTypeParameterConstraintAst[];
};

export type CSharpEnumDeclarationAst = {
  readonly kind: "enumDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly members: readonly CSharpEnumMemberAst[];
};

export type CSharpTypeDeclarationAst =
  | CSharpClassDeclarationAst
  | CSharpStructDeclarationAst
  | CSharpInterfaceDeclarationAst
  | CSharpEnumDeclarationAst;
