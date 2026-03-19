/**
 * Structural adaptation and materialization.
 * Converts expressions between structural types by emitting object initializers,
 * array-element adaptation, and dictionary-value adaptation.
 */

import { IrType } from "@tsonic/frontend";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";
import type { UpcastFn } from "./structural-adaptation-types.js";
import { tryAdaptStructuralObjectExpressionAst } from "./structural-object-adaptation.js";
import { tryAdaptStructuralCollectionExpressionAst } from "./structural-collection-adaptation.js";

export { hasNullishBranch } from "./exact-comparison.js";
export type {
  StructuralPropertyInfo,
  UpcastFn,
} from "./structural-adaptation-types.js";
export { collectStructuralProperties } from "./structural-property-model.js";
export { resolveAnonymousStructuralReferenceType } from "./structural-anonymous-targets.js";
export {
  canPreferAnonymousStructuralTarget,
  getArrayElementType,
  isObjectLikeTypeAst,
  isSameNominalType,
} from "./structural-type-shapes.js";

export const tryAdaptStructuralExpressionAst = (
  emittedAst: CSharpExpressionAst,
  sourceType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined,
  upcastFn?: UpcastFn
): [CSharpExpressionAst, EmitterContext] | undefined =>
  tryAdaptStructuralObjectExpressionAst(
    emittedAst,
    sourceType,
    context,
    expectedType,
    tryAdaptStructuralExpressionAst,
    upcastFn
  ) ??
  tryAdaptStructuralCollectionExpressionAst(
    emittedAst,
    sourceType,
    context,
    expectedType,
    tryAdaptStructuralExpressionAst,
    upcastFn
  );
