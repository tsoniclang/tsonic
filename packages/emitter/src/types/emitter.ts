/**
 * Type emission main dispatcher
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitPrimitiveType } from "./primitives.js";
import { emitReferenceType } from "./references.js";
import { emitArrayType } from "./arrays.js";
import { emitFunctionType } from "./functions.js";
import { emitObjectType } from "./objects.js";
import { emitUnionType } from "./unions.js";
import { emitIntersectionType } from "./intersections.js";
import { emitLiteralType } from "./literals.js";

/**
 * Emit a C# type from an IR type
 */
export const emitType = (
  type: IrType,
  context: EmitterContext
): [string, EmitterContext] => {
  switch (type.kind) {
    case "primitiveType":
      return emitPrimitiveType(type, context);

    case "referenceType":
      return emitReferenceType(type, context);

    case "arrayType":
      return emitArrayType(type, context);

    case "functionType":
      return emitFunctionType(type, context);

    case "objectType":
      return emitObjectType(type, context);

    case "unionType":
      return emitUnionType(type, context);

    case "intersectionType":
      return emitIntersectionType(type, context);

    case "literalType":
      return emitLiteralType(type, context);

    case "anyType":
      return ["dynamic", context];

    case "unknownType":
      return ["object?", context];

    case "voidType":
      return ["void", context];

    case "neverType":
      return ["void", context];

    default:
      // Fallback for unhandled types
      return ["object", context];
  }
};
