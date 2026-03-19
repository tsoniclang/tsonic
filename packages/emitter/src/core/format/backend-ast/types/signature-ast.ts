import type { CSharpExpressionAst } from "./expression-ast.js";
import type { CSharpTypeAst } from "./type-ast.js";

export type CSharpAttributeAst = {
  readonly type: CSharpTypeAst;
  readonly arguments?: readonly CSharpExpressionAst[];
  /** Attribute target specifier, e.g. "return", "assembly", "field" */
  readonly target?: string;
};

export type CSharpParameterAst = {
  readonly name: string;
  readonly type: CSharpTypeAst;
  readonly defaultValue?: CSharpExpressionAst;
  /** "ref", "out", "in", "params", "this" */
  readonly modifiers?: readonly string[];
  readonly attributes?: readonly CSharpAttributeAst[];
};

export type CSharpTypeParameterAst = {
  readonly name: string;
};

export type CSharpTypeParameterConstraintNodeAst =
  | {
      readonly kind: "typeConstraint";
      readonly type: CSharpTypeAst;
    }
  | {
      readonly kind: "classConstraint";
    }
  | {
      readonly kind: "structConstraint";
    }
  | {
      readonly kind: "constructorConstraint";
    };

export type CSharpTypeParameterConstraintAst = {
  readonly typeParameter: string;
  readonly constraints: readonly CSharpTypeParameterConstraintNodeAst[];
};
