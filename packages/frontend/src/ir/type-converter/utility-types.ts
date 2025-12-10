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
 * Check if ANY declaration in the list explicitly contains undefined.
 * Handles merged declarations where any declaration might have explicit undefined.
 */
const anyDeclarationHasExplicitUndefined = (
  declarations: readonly ts.Declaration[] | undefined
): boolean => {
  if (!declarations) return false;
  return declarations.some((decl) => {
    if (ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl)) {
      return typeNodeContainsUndefined(decl.type);
    }
    return false;
  });
};

/**
 * Check if a declaration has a readonly modifier.
 */
const declarationHasReadonlyModifier = (decl: ts.Declaration): boolean => {
  if (ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl)) {
    return (
      decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ??
      false
    );
  }
  return false;
};

/**
 * Get readonly status from TypeScript internal checkFlags.
 * WARNING: This uses TypeScript internal API (symbol.links.checkFlags).
 * The value 8 is CheckFlags.Readonly in TypeScript's internal enum.
 * This is necessary for mapped types where readonly is not in declaration modifiers.
 * If TypeScript internals change, this will need updating.
 */
const isReadonlyFromCheckFlags = (symbol: ts.Symbol): boolean => {
  const CHECK_FLAGS_READONLY = 8; // TypeScript internal: CheckFlags.Readonly
  const checkFlags =
    (symbol as unknown as { links?: { checkFlags?: number } }).links
      ?.checkFlags ?? 0;
  return (checkFlags & CHECK_FLAGS_READONLY) !== 0;
};

/**
 * Determine if a property is readonly.
 * Combines declaration-based check (stable) with internal checkFlags (for mapped types).
 * Prefers declaration-based when available for stability across TS versions.
 */
const isPropertyReadonly = (
  symbol: ts.Symbol,
  declarations: readonly ts.Declaration[] | undefined
): boolean => {
  // First try declaration-based (stable public API)
  const fromDeclaration =
    declarations?.some(declarationHasReadonlyModifier) ?? false;
  if (fromDeclaration) return true;

  // Fall back to internal checkFlags for mapped types (Readonly<T>, etc.)
  // This handles cases where readonly is synthesized, not in declaration
  return isReadonlyFromCheckFlags(symbol);
};

/**
 * Check if a property name is a non-string key (symbol or computed).
 * These cannot be represented as C# property names.
 */
const isNonStringKey = (symbol: ts.Symbol): boolean => {
  const propName = symbol.getName();
  return (
    propName.startsWith("__@") || // Internal symbol marker
    ((symbol.flags & ts.SymbolFlags.Transient) !== 0 &&
      propName.startsWith("["))
  );
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
  declarations: readonly ts.Declaration[] | undefined
): ts.TypeNode | undefined => {
  // If ANY declaration explicitly contains undefined, don't strip anything
  // This handles merged declarations where any might have explicit undefined
  if (anyDeclarationHasExplicitUndefined(declarations)) {
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

  // SAFETY: Check for index signatures - expansion would lose them
  // Never expand if doing so would drop members (compiler-grade rule)
  const stringIndexType = checker.getIndexInfoOfType(
    resolvedType,
    ts.IndexKind.String
  );
  const numberIndexType = checker.getIndexInfoOfType(
    resolvedType,
    ts.IndexKind.Number
  );
  if (stringIndexType || numberIndexType) {
    // Type has index signatures that cannot be represented in expansion
    // Return null to fall back to referenceType behavior
    return null;
  }

  // SAFETY: Check for non-string keys before processing
  // Never expand if doing so would drop members (compiler-grade rule)
  for (const prop of properties) {
    if (isNonStringKey(prop)) {
      // Type has symbol/computed keys that cannot be represented as C# properties
      // Return null to fall back to referenceType behavior
      return null;
    }
  }

  // Convert properties to IR members
  const members: IrInterfaceMember[] = [];

  for (const prop of properties) {
    const propType = checker.getTypeOfSymbolAtLocation(prop, node);

    // Get declarations for readonly check and explicit undefined detection
    const declarations = prop.getDeclarations();

    // Get optional/readonly status
    // TypeScript correctly sets Optional flag for Partial<T> properties
    const symbolOptional = (prop.flags & ts.SymbolFlags.Optional) !== 0;

    // Readonly: combine declaration-based (stable) with internal checkFlags (mapped types)
    const baseReadonly = isPropertyReadonly(prop, declarations);

    // Apply utility type transformations
    // Readonly<T> makes all properties readonly
    // Required<T> makes all properties required (non-optional)
    // Partial<T> - TypeScript already sets Optional flag, we just use it
    const isReadonly = typeName === "Readonly" ? true : baseReadonly;
    const isOptional = typeName === "Required" ? false : symbolOptional;

    // For optional properties, TypeScript includes `| undefined` in the type.
    // We strip ONLY synthetic undefined (from optionality), not explicit undefined.
    // Pass all declarations so we check ALL for explicit undefined (handles merges).
    // Use NoTruncation to get complete type representation.
    const typeNodeFlags = ts.NodeBuilderFlags.NoTruncation;
    const propTypeNode = isOptional
      ? stripSyntheticUndefined(
          propType,
          checker,
          node,
          typeNodeFlags,
          declarations
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
