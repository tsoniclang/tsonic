/**
 * TypeSystem Inference — Facade
 *
 * Re-exports all inference sub-modules to preserve the original import path.
 * The implementation is split into focused sub-modules:
 * - inference-utilities.ts: shared helpers (deriveTypeFromNumericKind, unwrapParens, etc.)
 * - inference-expressions.ts: inferExpressionType, inferLambdaType
 * - inference-initializers.ts: tryInferTypeFromLiteralInitializer, tryInferReturnTypeFromCallExpression, tryInferTypeFromInitializer
 * - inference-member-resolution.ts: typeOfMember, typeOfMemberId, getIndexerInfo, parseIndexerKeyClrType
 * - inference-declarations.ts: typeOfDecl, typeOfValueRead, hasTypeParameters, isTypeDecl, etc.
 *
 * DAG position: depends on type-system-state, type-system-relations, type-system-call-resolution
 */

// ── Inference Utilities ──────────────────────────────────────────────────
export {
  deriveTypeFromNumericKind,
  unwrapParens,
  isLambdaExpression,
  getNumericKindFromIrType,
  unwrapAwaitedForInference,
} from "./inference-utilities.js";

// ── Expression Type Inference ────────────────────────────────────────────
export {
  inferExpressionType,
  inferLambdaType,
} from "./inference-expressions.js";

// ── Initializer & Call Return Type Inference ─────────────────────────────
export {
  tryInferTypeFromLiteralInitializer,
  tryInferReturnTypeFromCallExpression,
  tryInferTypeFromInitializer,
} from "./inference-initializers.js";

// ── Member Type Resolution ───────────────────────────────────────────────
export {
  typeOfMember,
  typeOfMemberId,
  parseIndexerKeyClrType,
  getIndexerInfo,
} from "./inference-member-resolution.js";

// ── Declaration Type Queries & Inspection ────────────────────────────────
export {
  typeOfDecl,
  typeOfValueRead,
  getFQNameOfDecl,
  hasTypeParameters,
  isTypeDecl,
  isInterfaceDecl,
  isTypeAliasToObjectLiteral,
  signatureHasConditionalReturn,
  signatureHasVariadicTypeParams,
  declHasTypeAnnotation,
  checkTsClassMemberOverride,
  typeFromSyntax,
} from "./inference-declarations.js";
