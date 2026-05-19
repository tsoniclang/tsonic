import { IrType } from "@tsonic/frontend";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import { identifierType } from "../core/format/backend-ast/builders.js";
import type { EmitterContext } from "../types.js";

export type UpcastFn = (
  ast: CSharpExpressionAst,
  actualType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined,
  visited?: ReadonlySet<string>
) => [CSharpExpressionAst, EmitterContext] | undefined;

export type StructuralAdaptFn = (
  emittedAst: CSharpExpressionAst,
  sourceType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined,
  upcastFn?: UpcastFn
) => [CSharpExpressionAst, EmitterContext] | undefined;

export type StructuralPropertyInfo = {
  readonly name: string;
  readonly type: IrType;
  readonly isOptional: boolean;
};

export const buildDelegateType = (
  parameterTypes: readonly CSharpTypeAst[],
  returnType: CSharpTypeAst
): CSharpTypeAst =>
  identifierType("global::System.Func", [...parameterTypes, returnType]);
