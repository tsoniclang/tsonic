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
 * Check if a type node explicitly contains undefined in a union.
 * Used to detect explicit `x?: T | undefined` vs synthetic `x?: T`.
 */
const typeNodeContainsUndefined = (
  typeNode: ts.TypeNode | undefined
): boolean => {
  if (!typeNode) return false;
  if (ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.some(
      (t) => t.kind === ts.SyntaxKind.UndefinedKeyword
    );
  }
  return typeNode.kind === ts.SyntaxKind.UndefinedKeyword;
};

/**
 * Strip `undefined` from a union type, but ONLY the synthetic undefined
 * introduced by optionality. If the declaration explicitly included undefined
 * (like `x?: T | undefined`), we preserve it to maintain type semantics.
 *
 * Compiler-grade rule per review:
 * - Only strip the synthetic undefined introduced by optionality
 * - Do NOT strip explicit undefined that was already in the declared type
 * - If we can't reliably distinguish, don't strip (prefer correctness)
 */
const stripSyntheticUndefined = (
  type: ts.Type,
  checker: ts.TypeChecker,
  enclosingNode: ts.Node,
  flags: ts.NodeBuilderFlags,
  declarationTypeNode: ts.TypeNode | undefined
): ts.TypeNode | undefined => {
  // If declaration explicitly contains undefined, don't strip anything
  if (typeNodeContainsUndefined(declarationTypeNode)) {
    return checker.typeToTypeNode(type, enclosingNode, flags);
  }

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
      // For complex unions, don't strip - let emitter handle it
      // This is safer than potentially changing type semantics
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

  // Check if ANY type argument is a type parameter (generic)
  // We can only expand when ALL type arguments are concrete.
  // This is important for Pick<T, K> / Omit<T, K> where either T or K
  // could be a type parameter.
  const typeArgs = node.typeArguments;
  if (typeArgs) {
    for (const typeArg of typeArgs) {
      const argType = checker.getTypeAtLocation(typeArg);
      if (argType.flags & ts.TypeFlags.TypeParameter) {
        // At least one type argument is a type parameter - can't expand
        return null;
      }
    }
  }

  // Convert properties to IR members
  // NOTE: Index signatures (e.g., [key: string]: T) are NOT returned by
  // getProperties() and are intentionally not supported in utility type
  // expansion. If the source type has index signatures, they will be lost.
  const members: IrInterfaceMember[] = [];

  // CheckFlags.Readonly = 8 (internal TypeScript flag for mapped type readonly)
  const CHECK_FLAGS_READONLY = 8;

  for (const prop of properties) {
    // Skip non-string keys (symbols, computed properties)
    // These cannot be represented as C# property names
    const propName = prop.getName();
    if (
      propName.startsWith("__@") || // Internal symbol marker
      ((prop.flags & ts.SymbolFlags.Transient) !== 0 &&
        propName.startsWith("["))
    ) {
      // Skip symbol/computed keys - they can't be emitted as C# properties
      // TODO: Consider emitting a diagnostic for this
      continue;
    }

    const propType = checker.getTypeOfSymbolAtLocation(prop, node);

    // Get optional/readonly status from symbol flags and checkFlags
    // TypeScript correctly sets Optional flag for Partial<T> properties
    const symbolOptional = (prop.flags & ts.SymbolFlags.Optional) !== 0;

    // For mapped types like Readonly<T>, readonly is stored in symbol.links.checkFlags
    // not in the original declaration modifiers. This correctly handles nested
    // utility types like Partial<Readonly<T>> where readonly must be preserved.
    const checkFlags =
      (prop as unknown as { links?: { checkFlags?: number } }).links
        ?.checkFlags ?? 0;
    const baseReadonly = (checkFlags & CHECK_FLAGS_READONLY) !== 0;

    // Apply utility type transformations
    // Readonly<T> makes all properties readonly
    // Required<T> makes all properties required (non-optional)
    // Partial<T> - TypeScript already sets Optional flag, we just use it
    const isReadonly = typeName === "Readonly" ? true : baseReadonly;
    const isOptional = typeName === "Required" ? false : symbolOptional;

    // Get declarations for checking method signatures and explicit undefined
    const declarations = prop.getDeclarations();

    // Get the declaration's type node to check for explicit undefined
    const declarationTypeNode =
      declarations?.[0] &&
      (ts.isPropertySignature(declarations[0]) ||
        ts.isPropertyDeclaration(declarations[0]))
        ? declarations[0].type
        : undefined;

    // For optional properties, TypeScript includes `| undefined` in the type.
    // We strip ONLY synthetic undefined (from optionality), not explicit undefined.
    // Use NoTruncation to get complete type representation.
    const typeNodeFlags = ts.NodeBuilderFlags.NoTruncation;
    const propTypeNode = isOptional
      ? stripSyntheticUndefined(
          propType,
          checker,
          node,
          typeNodeFlags,
          declarationTypeNode
        )
      : checker.typeToTypeNode(propType, node, typeNodeFlags);

    // Check if it's a method or property
    const isMethod =
      declarations?.some(
        (decl) => ts.isMethodSignature(decl) || ts.isMethodDeclaration(decl)
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
