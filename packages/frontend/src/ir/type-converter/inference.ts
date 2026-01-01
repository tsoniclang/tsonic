/**
 * Type inference - Deterministic IR typing for lambda parameters
 *
 * IMPORTANT: Contextual type inference has been removed for INV-0 compliance.
 * Lambda parameter types must now come from:
 * 1. Explicit type annotations on parameters
 * 2. ExpectedType threaded from call argument position
 *
 * The banned APIs (getContextualType, getTypeOfSymbolAtLocation, typeToTypeNode)
 * are no longer used here. All typing is deterministic.
 */

import type * as ts from "typescript";
import type { IrType } from "../types.js";
import type { Binding } from "../binding/index.js";

/**
 * Result of inferring lambda parameter types from contextual signature.
 * Returns array of IrType (one per parameter) if all params can be inferred,
 * or undefined if inference fails for any parameter.
 */
export type LambdaParamInferenceResult = {
  readonly paramTypes: readonly (IrType | undefined)[];
  readonly allInferred: boolean;
};

/**
 * Infer parameter types for a lambda (arrow function or function expression).
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * This function no longer uses contextual type inference from TypeScript.
 * Lambda parameter types are determined by:
 * 1. Explicit type annotations on parameters → handled by param.type
 * 2. ExpectedType threaded from call argument position → handled by calls.ts
 *
 * Returns undefined to indicate that no contextual inference is performed.
 * The caller (expression converter) will use expectedType from the call site.
 */
export const inferLambdaParamTypes = (
  _node: ts.ArrowFunction | ts.FunctionExpression,
  _binding: Binding
): LambdaParamInferenceResult | undefined => {
  // Contextual inference removed for deterministic IR typing (INV-0).
  // Lambda params receive types via:
  // 1. Explicit type annotations on parameters
  // 2. ExpectedType threaded from call argument position (calls.ts:664-684)
  // TSN5202 catches missing types during validation.
  return undefined;
};
