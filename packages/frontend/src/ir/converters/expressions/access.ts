/**
 * Member access expression converters
 */

import * as ts from "typescript";
import { IrMemberExpression } from "../../types.js";
import { getInferredType } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { getBindingRegistry } from "../statements/declarations/registry.js";

/**
 * Resolve hierarchical binding for a member access
 * Handles namespace.type and type.member patterns
 */
const resolveHierarchicalBinding = (
  object: ReturnType<typeof convertExpression>,
  propertyName: string
): IrMemberExpression["memberBinding"] => {
  const registry = getBindingRegistry();

  // Case 1: object is identifier → check if it's a namespace, then check if property is a type
  if (object.kind === "identifier") {
    const namespace = registry.getNamespace(object.name);
    if (namespace) {
      // Found namespace binding, check if property is a type within this namespace
      // Note: After schema swap, we look up by alias (TS identifier)
      const type = namespace.types.find((t) => t.alias === propertyName);
      if (type) {
        // This member access is namespace.type - we don't emit a member binding here
        // because we're just accessing a type, not calling a member
        return undefined;
      }
    }
  }

  // Case 2: object is member expression with a type reference → check if property is a member
  if (object.kind === "memberAccess" && !object.isComputed) {
    // Walk up the chain to find if this is a type reference
    // For systemLinq.enumerable, the object is "systemLinq" and property is "enumerable"
    if (object.object.kind === "identifier") {
      const namespace = registry.getNamespace(object.object.name);
      if (namespace && typeof object.property === "string") {
        const type = namespace.types.find((t) => t.alias === object.property);
        if (type) {
          // The object is a type reference (namespace.type), now check if property is a member
          const member = type.members.find((m) => m.alias === propertyName);
          if (member) {
            // Found a member binding!
            return {
              assembly: member.binding.assembly,
              type: member.binding.type,
              member: member.binding.member,
            };
          }
        }
      }
    }
  }

  return undefined;
};

/**
 * Convert property access or element access expression
 */
export const convertMemberExpression = (
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  checker: ts.TypeChecker
): IrMemberExpression => {
  const isOptional = node.questionDotToken !== undefined;
  const inferredType = getInferredType(node, checker);

  if (ts.isPropertyAccessExpression(node)) {
    const object = convertExpression(node.expression, checker);
    const propertyName = node.name.text;

    // Try to resolve hierarchical binding
    const memberBinding = resolveHierarchicalBinding(object, propertyName);

    return {
      kind: "memberAccess",
      object,
      property: propertyName,
      isComputed: false,
      isOptional,
      inferredType,
      memberBinding,
    };
  } else {
    return {
      kind: "memberAccess",
      object: convertExpression(node.expression, checker),
      property: convertExpression(node.argumentExpression, checker),
      isComputed: true,
      isOptional,
      inferredType,
    };
  }
};
