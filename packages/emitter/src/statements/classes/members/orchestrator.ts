/**
 * Class member emission orchestrator
 */

import { IrClassMember } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitPropertyMember } from "./properties.js";
import { emitMethodMember } from "./methods.js";
import { emitConstructorMember } from "./constructors.js";

/**
 * Emit a class member (property, method, or constructor)
 */
export const emitClassMember = (
  member: IrClassMember,
  context: EmitterContext
): [string, EmitterContext] => {
  switch (member.kind) {
    case "propertyDeclaration":
      return emitPropertyMember(member, context);

    case "methodDeclaration":
      return emitMethodMember(member, context);

    case "constructorDeclaration":
      return emitConstructorMember(member, context);

    default:
      throw new Error(
        `Unhandled IR class member kind: ${String((member as { kind?: unknown }).kind)}`
      );
  }
};
