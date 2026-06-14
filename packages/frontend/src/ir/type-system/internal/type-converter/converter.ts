/**
 * Type converter - TSTS syntax types to IR types
 * Main dispatcher - re-exports from orchestrator
 *
 * Captured TSTS type nodes are converted inside the TypeSystem.
 */

import { IrType } from "../../../types.js";
import type { Binding } from "../../../binding/index.js";
import { convertType as convertTypeInternal } from "./orchestrator.js";
import { assertConverterNode } from "./tsts-syntax.js";
export { convertType } from "./orchestrator.js";
export { convertFunctionType } from "./functions.js";
export { convertObjectType } from "./objects.js";

/**
 * Convert a captured type node (unknown) to IrType.
 */
export const convertCapturedTypeNode = (
  node: unknown,
  binding: Binding
): IrType => convertTypeInternal(assertConverterNode(node), binding);
