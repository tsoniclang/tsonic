/**
 * Narrowing builder utilities — facade re-exports.
 *
 * Implementations live in:
 *   - narrowing-builder-core.ts
 *   - narrowing-builder-unions.ts
 */

export {
  type BranchTruthiness,
  type EmitExprAstFn,
  type RuntimeUnionFrame,
  toReceiverAst,
  buildUnionNarrowAst,
  buildSubsetUnionType,
  withoutNarrowedBinding,
  applyBinding,
  buildExprBinding,
  buildRuntimeSubsetExpressionAst,
  buildConditionalNullishGuardAst,
  tryStripConditionalNullishGuardAst,
  isArrayLikeNarrowingCandidate,
  narrowTypeByArrayShape,
  narrowTypeByNotAssignableTarget,
  currentNarrowedType,
  resolveRuntimeUnionFrame,
  isNullOrUndefined,
} from "./narrowing-builder-core.js";

export {
  buildRuntimeUnionComplementBinding,
  buildRuntimeUnionSubsetBinding,
  applyDirectTypeNarrowing,
} from "./narrowing-builder-unions.js";
