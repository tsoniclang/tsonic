import type { CSharpExpressionAst } from "./expression-ast.js";
import type { CSharpTypeAst } from "./type-ast.js";

export type CSharpTypePatternAst = {
  readonly kind: "typePattern";
  readonly type: CSharpTypeAst;
};

export type CSharpDeclarationPatternAst = {
  readonly kind: "declarationPattern";
  readonly type: CSharpTypeAst;
  readonly designation: string;
};

export type CSharpVarPatternAst = {
  readonly kind: "varPattern";
  readonly designation: string;
};

export type CSharpConstantPatternAst = {
  readonly kind: "constantPattern";
  readonly expression: CSharpExpressionAst;
};

export type CSharpDiscardPatternAst = {
  readonly kind: "discardPattern";
};

export type CSharpNegatedPatternAst = {
  readonly kind: "negatedPattern";
  readonly pattern: CSharpPatternAst;
};

export type CSharpPatternAst =
  | CSharpTypePatternAst
  | CSharpDeclarationPatternAst
  | CSharpVarPatternAst
  | CSharpConstantPatternAst
  | CSharpDiscardPatternAst
  | CSharpNegatedPatternAst;
