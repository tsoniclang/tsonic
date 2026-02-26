/**
 * Type converter - TypeScript types to IR types
 * Main dispatcher - re-exports from orchestrator
 *
 * Phase 5 Step 4: Added convertCapturedTypeNode for cast encapsulation.
 */

import * as ts from "typescript";
import { IrType } from "../../../types.js";
import type { Binding } from "../../../binding/index.js";
import { convertType as convertTypeInternal } from "./orchestrator.js";
export { convertType } from "./orchestrator.js";
export { convertFunctionType } from "./functions.js";
export { convertObjectType } from "./objects.js";

/**
 * Convert a captured type node (unknown) to IrType.
 *
 * This function encapsulates the ts.TypeNode cast in one place.
 * Per Alice's spec: all TypeNode casts should be inside type-system/internal.
 */
export const convertCapturedTypeNode = (
  node: unknown,
  binding: Binding
): IrType => convertTypeInternal(node as ts.TypeNode, binding);
