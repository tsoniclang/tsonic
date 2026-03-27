/**
 * Expression types for IR (facade)
 *
 * Sub-modules:
 * - expressions-core.ts     : base types, union, primary expression nodes
 * - expressions-extended.ts : numeric narrowing, assertions, intrinsics, proofs
 */

export type {
  IrExpressionBase,
  IrExpression,
  IrLiteralExpression,
  IrIdentifierExpression,
  IrArrayExpression,
  IrObjectExpression,
  IrObjectProperty,
  IrFunctionExpression,
  IrArrowFunctionExpression,
  ComputedAccessKind,
  ComputedAccessProtocol,
  IrMemberExpression,
  IrCallExpression,
  IrNewExpression,
  IrThisExpression,
  IrUpdateExpression,
  IrUnaryExpression,
  IrBinaryExpression,
  IrLogicalExpression,
  IrConditionalExpression,
  IrAssignmentExpression,
  IrTemplateLiteralExpression,
  IrSpreadExpression,
  IrAwaitExpression,
  IrYieldExpression,
} from "./expressions-core.js";

export type {
  IrNumericNarrowingExpression,
  NumericProof,
  ProofSource,
  IrTypeAssertionExpression,
  IrAsInterfaceExpression,
  IrTryCastExpression,
  IrStackAllocExpression,
  IrDefaultOfExpression,
  IrNameOfExpression,
  IrSizeOfExpression,
} from "./expressions-extended.js";
