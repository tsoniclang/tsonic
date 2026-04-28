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
  buildProjectedExprBinding,
  resolveExistingNarrowingSourceType,
  buildRuntimeSubsetExpressionAst,
  buildConditionalNullishGuardAst,
  tryStripConditionalNullishGuardAst,
  narrowTypeByNotAssignableTarget,
  currentNarrowedType,
  resolveRuntimeUnionFrame,
  resolveRuntimeSubsetSourceInfo,
  isNullOrUndefined,
} from "./narrowing-builder-core.js";

export {
  buildRuntimeUnionComplementBinding,
  buildRuntimeUnionSubsetBinding,
  applyDirectTypeNarrowing,
} from "./narrowing-builder-unions.js";
