/**
 * Class member emission orchestrator
 */

import { IrClassMember } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../../../types.js";
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
  const ind = getIndent(context);

  switch (member.kind) {
    case "propertyDeclaration":
      return emitPropertyMember(member, context);

    case "methodDeclaration":
      return emitMethodMember(member, context);

    case "constructorDeclaration":
      return emitConstructorMember(member, context);

    default:
      return [`${ind}// TODO: unhandled class member`, context];
  }
};
