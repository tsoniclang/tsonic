/**
 * Strict receiver classification helpers for call emission.
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";

const isPrimitiveReceiverExtensionCall = (
  receiverType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!receiverType) return false;
  const resolved = resolveTypeAlias(stripNullish(receiverType), context);
  return resolved.kind === "primitiveType" || resolved.kind === "literalType";
};

export { isPrimitiveReceiverExtensionCall };
