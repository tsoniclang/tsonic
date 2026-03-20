/**
 * Conditional utility type expansion — Facade
 *
 * Re-exports from sub-modules:
 * - conditional-utility-types-core: core infrastructure, NonNullable, Exclude/Extract
 * - conditional-utility-types-extract: ReturnType, Parameters, Awaited,
 *     ConstructorParameters, InstanceType
 *
 * Provides the public `expandConditionalUtilityType` entry point that delegates
 * to `expandConditionalUtilityTypeInternal` with depth=0.
 */

import * as ts from "typescript";
import type { IrType } from "../../../types.js";
import type { Binding } from "../../../binding/index.js";
import { expandConditionalUtilityTypeInternal } from "./conditional-utility-types-core.js";

export {
  EXPANDABLE_CONDITIONAL_UTILITY_TYPES,
  isExpandableConditionalUtilityType,
} from "./conditional-utility-types-core.js";

/**
 * Expand a conditional utility type (NonNullable, Exclude, Extract, etc.) to IR.
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Uses AST-based syntactic algorithms only. No getTypeAtLocation or typeToTypeNode.
 */
export const expandConditionalUtilityType = (
  node: ts.TypeReferenceNode,
  typeName: string,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  return expandConditionalUtilityTypeInternal(
    node,
    typeName,
    binding,
    convertType,
    0
  );
};
