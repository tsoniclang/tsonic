/**
 * Type emission main dispatcher
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitPrimitiveType } from "./primitives.js";
import { emitReferenceType } from "./references.js";
import { emitArrayType } from "./arrays.js";
import { emitTupleType } from "./tuples.js";
import { emitFunctionType } from "./functions.js";
import { emitObjectType } from "./objects.js";
import { emitDictionaryType } from "./dictionaries.js";
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

    case "typeParameterType":
      // Type parameters emit as their mapped name (e.g., A -> TA) when needed to avoid
      // CLR naming collisions with members after namingPolicy transforms.
      return [context.typeParameterNameMap?.get(type.name) ?? type.name, context];

    case "arrayType":
      return emitArrayType(type, context);

    case "tupleType":
      return emitTupleType(type, context);

    case "functionType":
      return emitFunctionType(type, context);

    case "objectType":
      return emitObjectType(type, context);

    case "dictionaryType":
      return emitDictionaryType(type, context);

    case "unionType":
      return emitUnionType(type, context);

    case "intersectionType":
      return emitIntersectionType(type, context);

    case "literalType":
      return emitLiteralType(type, context);

    case "anyType":
      // ICE: Frontend validation (TSN7401) should have caught this.
      throw new Error(
        "ICE: 'any' type reached emitter - validation missed TSN7401"
      );

    case "unknownType":
      // 'unknown' is a legitimate type - emit as nullable object
      return ["object?", context];

    case "voidType":
      return ["void", context];

    case "neverType":
      return ["void", context];

    default: {
      // ICE: All IR types should be handled explicitly
      const exhaustiveCheck: never = type;
      throw new Error(
        `ICE: Unhandled IR type kind: ${(exhaustiveCheck as IrType).kind}`
      );
    }
  }
};
