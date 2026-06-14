/**
 * Enum declaration converter
 */

import {
  getTstsInitializerNode,
  getTstsNodeNameText,
  getTstsPropertyNameText,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import { IrEnumDeclaration, IrType } from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { definedTstsNodes, hasExportModifier } from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";

/**
 * Int type constant for enum initializers
 * Enums in target use int values, so we pass this as expectedType for deterministic typing.
 */
const INT_TYPE: IrType = { kind: "primitiveType", name: "int" };

/**
 * Convert enum declaration
 */
export const convertEnumDeclaration = (
  node: TstsNode,
  ctx: ProgramContext
): IrEnumDeclaration => {
  return {
    kind: "enumDeclaration",
    name: getTstsNodeNameText(node) ?? "_",
    members: definedTstsNodes(TstsSyntax.Node_Members(node)).map((m) => {
        const initializer = getTstsInitializerNode(m);
        return {
          kind: "enumMember" as const,
          name: getTstsPropertyNameText(m) ?? "[computed]",
          // Thread int type to enum initializers for deterministic typing
          initializer: initializer
            ? convertExpression(initializer, ctx, INT_TYPE)
            : undefined,
        };
      }),
    isExported: hasExportModifier(node),
  };
};
