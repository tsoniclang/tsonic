/**
 * Conditional utility type expansion - core infrastructure, NonNullable,
 * and Exclude/Extract expansion.
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * These utility types are expanded using AST-based syntactic algorithms only.
 * No banned APIs (getTypeAtLocation, getTypeOfSymbolAtLocation, typeToTypeNode).
 * Uses Binding for symbol resolution and extracts types from TypeNodes.
 *
 * Split from conditional-utility-types.ts for file-size compliance (< 500 LOC).
 */

import * as ts from "typescript";
import { IrType } from "../../../types.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import {
  isExpandableUtilityType,
  isTypeParameterNode,
  typeNodeContainsTypeParameter,
  flattenUnionIrType,
  isProvablyAssignable,
} from "./mapped-utility-types.js";

/**
 * Set of supported conditional utility types that can be expanded
 * Uses AST-based syntactic algorithms, not TS type evaluation.
 */
export const EXPANDABLE_CONDITIONAL_UTILITY_TYPES = new Set([
  "NonNullable",
  "Exclude",
  "Extract",
  "ReturnType",
  "Parameters",
  "Awaited",
  "ConstructorParameters",
  "InstanceType",
]);

/**
 * Check if a type name is an expandable conditional utility type
 */
export const isExpandableConditionalUtilityType = (name: string): boolean =>
  EXPANDABLE_CONDITIONAL_UTILITY_TYPES.has(name);

/**
 * Maximum recursion depth for nested conditional utility expansion.
 * Prevents infinite recursion on cyclic aliases or pathological inputs.
 */
export const MAX_CONDITIONAL_UTILITY_RECURSION = 16;

/**
 * Resolve a type alias to its underlying TypeNode (AST-based, INV-0 compliant).
 * Follows type alias chains to get the actual type definition.
 *
 * @param node - The TypeNode to resolve
 * @param binding - The Binding layer for symbol resolution
 * @returns The resolved TypeNode, or the original if not a resolvable alias
 */
export const resolveTypeAlias = (node: ts.TypeNode, binding: Binding): ts.TypeNode => {
  // Only type references can be aliases
  if (!ts.isTypeReferenceNode(node)) return node;
  if (!ts.isIdentifier(node.typeName)) return node;

  // IMPORTANT: Do not resolve compiler-known utility types to their lib.d.ts
  // conditional/type-alias definitions. We treat these as intrinsic and expand
  // them ourselves (deterministically) when requested.
  const name = node.typeName.text;
  if (
    isExpandableUtilityType(name) ||
    isExpandableConditionalUtilityType(name) ||
    name === "Record" ||
    name === "CLROf" ||
    name === "out" ||
    name === "ref" ||
    name === "inref"
  ) {
    return node;
  }

  // Use Binding to resolve the type reference
  const declId = binding.resolveTypeReference(node);
  if (!declId) return node;

  const declInfo = (binding as BindingInternal)
    ._getHandleRegistry()
    .getDecl(declId);
  if (!declInfo) return node;

  // Look for a type alias declaration
  const decl = declInfo.declNode as ts.Declaration | undefined;
  if (!decl || !ts.isTypeAliasDeclaration(decl)) return node;

  // Recursively resolve in case of chained aliases
  return resolveTypeAlias(decl.type, binding);
};

export const unwrapParens = (node: ts.TypeNode): ts.TypeNode => {
  let current: ts.TypeNode = node;
  while (ts.isParenthesizedTypeNode(current)) {
    current = current.type;
  }
  return current;
};

export const flattenUnionTypeNodes = (node: ts.TypeNode): readonly ts.TypeNode[] => {
  const unwrapped = unwrapParens(node);
  if (!ts.isUnionTypeNode(unwrapped)) return [unwrapped];

  const parts: ts.TypeNode[] = [];
  for (const t of unwrapped.types) {
    parts.push(...flattenUnionTypeNodes(t));
  }
  return parts;
};

/**
 * Expand NonNullable<T> using syntactic filtering (INV-0 compliant).
 */
export const expandNonNullable = (
  typeArg: ts.TypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  // Check for type parameter
  if (isTypeParameterNode(typeArg, binding)) {
    return null;
  }

  // Resolve type aliases to get the underlying type
  const resolved = resolveTypeAlias(typeArg, binding);

  // Handle special keywords
  if (resolved.kind === ts.SyntaxKind.AnyKeyword) return { kind: "anyType" };
  if (resolved.kind === ts.SyntaxKind.UnknownKeyword)
    return { kind: "unknownType" };
  if (resolved.kind === ts.SyntaxKind.NeverKeyword)
    return { kind: "neverType" };

  // Syntactic filtering of union types
  if (ts.isUnionTypeNode(resolved)) {
    const filtered = resolved.types.filter((t) => {
      // Direct null/undefined keywords
      if (t.kind === ts.SyntaxKind.NullKeyword) return false;
      if (t.kind === ts.SyntaxKind.UndefinedKeyword) return false;
      // LiteralTypeNode wrapping null/undefined
      if (
        ts.isLiteralTypeNode(t) &&
        (t.literal.kind === ts.SyntaxKind.NullKeyword ||
          t.literal.kind === ts.SyntaxKind.UndefinedKeyword)
      ) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) return { kind: "neverType" };
    if (filtered.length === 1 && filtered[0]) {
      return convertType(filtered[0], binding);
    }

    return {
      kind: "unionType",
      types: filtered.map((t) => convertType(t, binding)),
    };
  }

  // Not a union — return as-is (null/undefined are already filtered by check above)
  if (resolved.kind === ts.SyntaxKind.NullKeyword) return { kind: "neverType" };
  if (resolved.kind === ts.SyntaxKind.UndefinedKeyword)
    return { kind: "neverType" };

  return convertType(resolved, binding);
};

/**
 * Expand Exclude<T, U> or Extract<T, U> using syntactic filtering (INV-0 compliant).
 */
export const expandExcludeExtract = (
  tArg: ts.TypeNode,
  uArg: ts.TypeNode,
  isExtract: boolean,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType,
  depth: number
): IrType | null => {
  // Check for type parameters
  if (typeNodeContainsTypeParameter(tArg, binding)) {
    return null;
  }
  if (typeNodeContainsTypeParameter(uArg, binding)) {
    return null;
  }

  if (depth > MAX_CONDITIONAL_UTILITY_RECURSION) {
    return null;
  }

  const tryExpandConditionalArg = (node: ts.TypeNode): IrType | null => {
    const unwrapped = unwrapParens(node);
    if (
      !ts.isTypeReferenceNode(unwrapped) ||
      !ts.isIdentifier(unwrapped.typeName)
    ) {
      return null;
    }
    const name = unwrapped.typeName.text;
    if (!isExpandableConditionalUtilityType(name)) {
      return null;
    }
    if (!unwrapped.typeArguments?.length) {
      return null;
    }
    return expandConditionalUtilityTypeInternal(
      unwrapped,
      name,
      binding,
      convertType,
      depth + 1
    );
  };

  const convertForFiltering = (node: ts.TypeNode): IrType | null => {
    const directExpanded = tryExpandConditionalArg(node);
    if (directExpanded) return directExpanded;

    const resolved = unwrapParens(
      resolveTypeAlias(unwrapParens(node), binding)
    );
    const resolvedExpanded = tryExpandConditionalArg(resolved);
    if (resolvedExpanded) return resolvedExpanded;

    if (ts.isUnionTypeNode(resolved)) {
      const parts = flattenUnionTypeNodes(resolved);
      const converted: IrType[] = [];
      for (const p of parts) {
        const inner = convertForFiltering(p);
        if (!inner) return null;
        converted.push(inner);
      }
      return { kind: "unionType", types: converted };
    }

    return convertType(resolved, binding);
  };

  const tType = convertForFiltering(tArg);
  const uType = convertForFiltering(uArg);
  if (!tType || !uType) {
    return null;
  }

  const tMembers = flattenUnionIrType(tType);

  const filtered: IrType[] = [];
  for (const t of tMembers) {
    const assignable = isProvablyAssignable(t, uType);
    if (isExtract) {
      // Conservative: keep unless we can prove NOT assignable
      if (assignable !== false) {
        filtered.push(t);
      }
    } else {
      // Conservative: exclude only when we can prove assignable
      if (assignable !== true) {
        filtered.push(t);
      }
    }
  }

  if (filtered.length === 0) return { kind: "neverType" };
  if (filtered.length === 1) return filtered[0] ?? { kind: "neverType" };
  return { kind: "unionType", types: filtered };
};

/**
 * Internal recursive expander for conditional utility types.
 * Exported for use by sub-modules.
 */
export const expandConditionalUtilityTypeInternal = (
  node: ts.TypeReferenceNode,
  typeName: string,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType,
  depth: number
): IrType | null => {
  if (depth > MAX_CONDITIONAL_UTILITY_RECURSION) {
    return null;
  }

  const typeArgs = node.typeArguments;
  if (!typeArgs || typeArgs.length === 0) {
    return null;
  }

  // Check for type parameters in any argument
  for (const typeArg of typeArgs) {
    if (typeNodeContainsTypeParameter(typeArg, binding)) {
      return null;
    }
  }

  const firstArg = typeArgs[0];
  if (!firstArg) {
    return null;
  }

  // Import the extract-type expanders lazily to avoid circular dependency
  // at module load time. They are in the sibling sub-module.
  switch (typeName) {
    case "NonNullable":
      return expandNonNullable(firstArg, binding, convertType);

    case "Exclude": {
      const secondArg = typeArgs[1];
      if (!secondArg) return null;
      return expandExcludeExtract(
        firstArg,
        secondArg,
        false,
        binding,
        convertType,
        depth
      );
    }

    case "Extract": {
      const secondArg = typeArgs[1];
      if (!secondArg) return null;
      return expandExcludeExtract(
        firstArg,
        secondArg,
        true,
        binding,
        convertType,
        depth
      );
    }

    case "ReturnType":
      return expandReturnTypeFromExtract(firstArg, binding, convertType);

    case "Parameters":
      return expandParametersFromExtract(firstArg, binding, convertType);

    case "Awaited":
      return expandAwaitedFromExtract(firstArg, binding, convertType);

    case "ConstructorParameters":
      return expandConstructorParametersFromExtract(firstArg, binding, convertType);

    case "InstanceType":
      return expandInstanceTypeFromExtract(firstArg, binding, convertType);

    default:
      return null;
  }
};

// These imports are resolved at call time to avoid circular module issues.
// The functions are defined in conditional-utility-types-extract.ts.
import {
  expandReturnType as expandReturnTypeFromExtract,
  expandParameters as expandParametersFromExtract,
  expandAwaited as expandAwaitedFromExtract,
  expandConstructorParameters as expandConstructorParametersFromExtract,
  expandInstanceType as expandInstanceTypeFromExtract,
} from "./conditional-utility-types-extract.js";
