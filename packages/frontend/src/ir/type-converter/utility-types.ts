/**
 * Utility type expansion - Partial, Required, Readonly, Pick, Omit
 *
 * These utility types are expanded at compile time by resolving the type
 * through TypeScript's type checker and converting the result to IrObjectType.
 */

import * as ts from "typescript";
import {
  IrType,
  IrObjectType,
  IrPropertySignature,
  IrMethodSignature,
  IrInterfaceMember,
} from "../types.js";

/**
 * Set of supported mapped utility types that can be expanded
 */
export const EXPANDABLE_UTILITY_TYPES = new Set([
  "Partial",
  "Required",
  "Readonly",
  "Pick",
  "Omit",
]);

/**
 * Check if a type name is an expandable utility type
 */
export const isExpandableUtilityType = (name: string): boolean =>
  EXPANDABLE_UTILITY_TYPES.has(name);

/**
 * Strip `undefined` from a union type.
 * TypeScript includes `| undefined` for optional properties, but we handle
 * optionality via the `isOptional` flag in IR to avoid double-nullable in C#.
 */
const stripUndefinedFromType = (
  type: ts.Type,
  checker: ts.TypeChecker,
  enclosingNode: ts.Node,
  flags: ts.NodeBuilderFlags
): ts.TypeNode | undefined => {
  // Check if it's a union type
  if (type.isUnion()) {
    // Filter out undefined from the union
    const filteredTypes = type.types.filter(
      (t) => !(t.flags & ts.TypeFlags.Undefined)
    );

    // If only one type remains, return that type's node
    const firstType = filteredTypes[0];
    if (filteredTypes.length === 1 && firstType) {
      return checker.typeToTypeNode(firstType, enclosingNode, flags);
    }

    // If multiple types remain (excluding undefined), keep them as union
    // This happens for things like `string | number | undefined` → `string | number`
    if (filteredTypes.length > 1) {
      // The original type node should preserve the structure;
      // we'll convert the type but TypeScript will include undefined.
      // As a workaround, just return the original type node and let
      // the emitter handle it. The double-nullable is the lesser evil
      // for complex union types.
      // TODO: For complex unions, we might need custom handling
      return checker.typeToTypeNode(type, enclosingNode, flags);
    }

    // All types were undefined (shouldn't happen) - return undefined type
    return checker.typeToTypeNode(type, enclosingNode, flags);
  }

  // Not a union - return as-is
  return checker.typeToTypeNode(type, enclosingNode, flags);
};

/**
 * Expand a mapped utility type to an IrObjectType.
 *
 * This function uses TypeScript's type checker to resolve the utility type
 * and extracts the properties from the resolved type.
 *
 * @param node - The TypeReferenceNode for the utility type
 * @param typeName - The name of the utility type (Partial, Required, etc.)
 * @param checker - The TypeScript type checker
 * @param convertType - Function to convert nested types
 * @returns IrObjectType with the expanded properties, or null if expansion fails
 */
export const expandUtilityType = (
  node: ts.TypeReferenceNode,
  typeName: string,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrObjectType | null => {
  // Get the resolved type from TypeScript's type checker
  const resolvedType = checker.getTypeAtLocation(node);

  // Check if the type has properties (object-like)
  const properties = resolvedType.getProperties();
  if (!properties || properties.length === 0) {
    // Type parameter or empty type - can't expand
    return null;
  }

  // Check if the type argument is a type parameter (generic)
  // In this case, we can't expand at compile time
  const typeArgs = node.typeArguments;
  const firstTypeArg = typeArgs?.[0];
  if (firstTypeArg) {
    const argType = checker.getTypeAtLocation(firstTypeArg);
    if (argType.flags & ts.TypeFlags.TypeParameter) {
      // T is a type parameter - can't expand
      return null;
    }
  }

  // Convert properties to IR members
  const members: IrInterfaceMember[] = [];

  for (const prop of properties) {
    const propType = checker.getTypeOfSymbolAtLocation(prop, node);

    // Get optional/readonly status from symbol flags
    // TypeScript correctly sets Optional flag for Partial<T> properties
    const symbolOptional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
    const declarations = prop.getDeclarations();
    const baseReadonly =
      declarations?.some((decl) => {
        if (ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl)) {
          return decl.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
          );
        }
        return false;
      }) ?? false;

    // Apply utility type transformations
    // Readonly<T> makes all properties readonly
    // Required<T> makes all properties required (non-optional)
    // Partial<T> - TypeScript already sets Optional flag, we just use it
    const isReadonly = typeName === "Readonly" ? true : baseReadonly;
    const isOptional =
      typeName === "Required" ? false : symbolOptional;

    // For optional properties, TypeScript includes `| undefined` in the type.
    // We need to strip undefined to avoid double-nullable in C#.
    // Use NoTruncation to get complete type representation.
    const typeNodeFlags = ts.NodeBuilderFlags.NoTruncation;
    const propTypeNode = isOptional
      ? stripUndefinedFromType(propType, checker, node, typeNodeFlags)
      : checker.typeToTypeNode(propType, node, typeNodeFlags);

    // Check if it's a method or property
    const isMethod =
      declarations?.some(
        (decl) =>
          ts.isMethodSignature(decl) || ts.isMethodDeclaration(decl)
      ) ?? false;

    if (isMethod && propTypeNode && ts.isFunctionTypeNode(propTypeNode)) {
      // Method signature
      const methSig: IrMethodSignature = {
        kind: "methodSignature",
        name: prop.name,
        parameters: propTypeNode.parameters.map((param) => ({
          kind: "parameter" as const,
          pattern: {
            kind: "identifierPattern" as const,
            name: param.name.getText(),
          },
          type: param.type ? convertType(param.type, checker) : undefined,
          isOptional: !!param.questionToken,
          isRest: !!param.dotDotDotToken,
          passing: "value" as const,
        })),
        returnType: propTypeNode.type
          ? convertType(propTypeNode.type, checker)
          : undefined,
      };
      members.push(methSig);
    } else {
      // Property signature
      const propSig: IrPropertySignature = {
        kind: "propertySignature",
        name: prop.name,
        type: propTypeNode
          ? convertType(propTypeNode, checker)
          : { kind: "anyType" },
        isOptional,
        isReadonly,
      };
      members.push(propSig);
    }
  }

  return { kind: "objectType", members };
};
