/**
 * Conditional utility type expansion - NonNullable, Exclude, Extract,
 * ReturnType, Parameters, Awaited, ConstructorParameters, InstanceType
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * These utility types are expanded using AST-based syntactic algorithms only.
 * No banned APIs (getTypeAtLocation, getTypeOfSymbolAtLocation, typeToTypeNode).
 * Uses Binding for symbol resolution and extracts types from TypeNodes.
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
const MAX_CONDITIONAL_UTILITY_RECURSION = 16;

/**
 * Resolve a type alias to its underlying TypeNode (AST-based, INV-0 compliant).
 * Follows type alias chains to get the actual type definition.
 *
 * @param node - The TypeNode to resolve
 * @param binding - The Binding layer for symbol resolution
 * @returns The resolved TypeNode, or the original if not a resolvable alias
 */
const resolveTypeAlias = (node: ts.TypeNode, binding: Binding): ts.TypeNode => {
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

const unwrapParens = (node: ts.TypeNode): ts.TypeNode => {
  let current: ts.TypeNode = node;
  while (ts.isParenthesizedTypeNode(current)) {
    current = current.type;
  }
  return current;
};

const flattenUnionTypeNodes = (node: ts.TypeNode): readonly ts.TypeNode[] => {
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
const expandNonNullable = (
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

const expandConditionalUtilityTypeInternal = (
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
      return expandReturnType(firstArg, binding, convertType);

    case "Parameters":
      return expandParameters(firstArg, binding, convertType);

    case "Awaited":
      return expandAwaited(firstArg, binding, convertType);

    case "ConstructorParameters":
      return expandConstructorParameters(firstArg, binding, convertType);

    case "InstanceType":
      return expandInstanceType(firstArg, binding, convertType);

    default:
      return null;
  }
};

/**
 * Expand Exclude<T, U> or Extract<T, U> using syntactic filtering (INV-0 compliant).
 */
const expandExcludeExtract = (
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
 * Expand ReturnType<F> by extracting from function type declaration (INV-0 compliant).
 */
const expandReturnType = (
  fArg: ts.TypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  // Check for type parameter
  if (isTypeParameterNode(fArg, binding)) {
    return null;
  }

  // Distribute over unions: ReturnType<F1 | F2> = ReturnType<F1> | ReturnType<F2>
  const unwrapped = unwrapParens(fArg);
  if (ts.isUnionTypeNode(unwrapped)) {
    const results: IrType[] = [];
    for (const member of flattenUnionTypeNodes(unwrapped)) {
      const result = expandReturnType(member, binding, convertType);
      if (!result) return null;
      results.push(result);
    }
    const flat = results.flatMap((t) => flattenUnionIrType(t));
    if (flat.length === 0) return { kind: "neverType" };
    if (flat.length === 1) return flat[0] ?? { kind: "neverType" };
    return { kind: "unionType", types: flat };
  }

  // Case 1: Direct function type node
  if (ts.isFunctionTypeNode(unwrapped)) {
    return unwrapped.type
      ? convertType(unwrapped.type, binding)
      : { kind: "voidType" };
  }

  // Case 2: Type reference to function type alias
  if (
    ts.isTypeReferenceNode(unwrapped) &&
    ts.isIdentifier(unwrapped.typeName)
  ) {
    const declId = binding.resolveTypeReference(unwrapped);
    if (declId) {
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const decl = declInfo?.declNode as ts.Declaration | undefined;
      if (
        decl &&
        ts.isTypeAliasDeclaration(decl) &&
        ts.isFunctionTypeNode(decl.type)
      ) {
        return decl.type.type
          ? convertType(decl.type.type, binding)
          : { kind: "voidType" };
      }
    }
  }

  // Case 3: typeof function value (ReturnType<typeof fn>)
  //
  // INV-0 COMPLIANT: Resolve the identifier to a declaration via Binding and
  // read the syntactic return type annotation (no ts.Type queries).
  if (ts.isTypeQueryNode(unwrapped) && ts.isIdentifier(unwrapped.exprName)) {
    const declId = binding.resolveIdentifier(unwrapped.exprName);
    if (declId) {
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const decl = declInfo?.declNode as ts.Declaration | undefined;

      if (
        decl &&
        (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl))
      ) {
        return decl.type ? convertType(decl.type, binding) : null;
      }

      if (decl && ts.isVariableDeclaration(decl) && decl.type) {
        return expandReturnType(decl.type, binding, convertType);
      }
    }
  }

  return null; // Can't extract return type
};

/**
 * Expand Parameters<F> by extracting from function type declaration (INV-0 compliant).
 */
const expandParameters = (
  fArg: ts.TypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  // Check for type parameter
  if (isTypeParameterNode(fArg, binding)) {
    return null;
  }

  let functionType: ts.FunctionTypeNode | undefined;

  // Case 1: Direct function type node
  if (ts.isFunctionTypeNode(fArg)) {
    functionType = fArg;
  }

  // Case 2: Type reference to function type alias
  if (
    !functionType &&
    ts.isTypeReferenceNode(fArg) &&
    ts.isIdentifier(fArg.typeName)
  ) {
    const declId = binding.resolveTypeReference(fArg);
    if (declId) {
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const decl = declInfo?.declNode as ts.Declaration | undefined;
      if (
        decl &&
        ts.isTypeAliasDeclaration(decl) &&
        ts.isFunctionTypeNode(decl.type)
      ) {
        functionType = decl.type;
      }
    }
  }

  // Case 3: typeof function value (Parameters<typeof fn>)
  //
  // INV-0 COMPLIANT: Resolve the identifier to a declaration via Binding and
  // read syntactic parameter type annotations (no ts.Type queries).
  if (
    !functionType &&
    ts.isTypeQueryNode(fArg) &&
    ts.isIdentifier(fArg.exprName)
  ) {
    const declId = binding.resolveIdentifier(fArg.exprName);
    if (declId) {
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const decl = declInfo?.declNode as ts.Declaration | undefined;

      if (
        decl &&
        (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl))
      ) {
        const paramTypes: IrType[] = decl.parameters.map((param) =>
          param.type ? convertType(param.type, binding) : { kind: "anyType" }
        );
        return { kind: "tupleType", elementTypes: paramTypes };
      }

      if (decl && ts.isVariableDeclaration(decl) && decl.type) {
        return expandParameters(decl.type, binding, convertType);
      }
    }
  }

  if (!functionType) {
    return null; // Can't extract parameters
  }

  // Build tuple type from parameters
  const paramTypes: IrType[] = functionType.parameters.map((param) =>
    param.type ? convertType(param.type, binding) : { kind: "anyType" }
  );

  return { kind: "tupleType", elementTypes: paramTypes };
};

/**
 * Expand Awaited<T> by extracting from Promise type parameter (INV-0 compliant).
 */
const expandAwaited = (
  tArg: ts.TypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  // Check for type parameter
  if (isTypeParameterNode(tArg, binding)) {
    return null;
  }

  // Handle Promise<T> or PromiseLike<T>
  if (ts.isTypeReferenceNode(tArg) && ts.isIdentifier(tArg.typeName)) {
    const name = tArg.typeName.text;
    if ((name === "Promise" || name === "PromiseLike") && tArg.typeArguments) {
      const innerArg = tArg.typeArguments[0];
      if (innerArg) {
        // Recursively unwrap nested promises
        return (
          expandAwaited(innerArg, binding, convertType) ??
          convertType(innerArg, binding)
        );
      }
    }
  }

  // Not a Promise type - return as-is
  return convertType(tArg, binding);
};

/**
 * Expand ConstructorParameters<C> by extracting constructor parameter types.
 */
const expandConstructorParameters = (
  ctorArg: ts.TypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  if (isTypeParameterNode(ctorArg, binding)) {
    return null;
  }

  const unwrapped = unwrapParens(ctorArg);
  if (ts.isUnionTypeNode(unwrapped)) {
    const members: IrType[] = [];
    for (const member of flattenUnionTypeNodes(unwrapped)) {
      const expanded = expandConstructorParameters(
        member,
        binding,
        convertType
      );
      if (!expanded) return null;
      members.push(expanded);
    }
    if (members.length === 0) return { kind: "neverType" };
    if (members.length === 1) return members[0] ?? { kind: "neverType" };
    return { kind: "unionType", types: members };
  }

  if (ts.isConstructorTypeNode(unwrapped)) {
    return {
      kind: "tupleType",
      elementTypes: unwrapped.parameters.map((param) =>
        param.type ? convertType(param.type, binding) : { kind: "unknownType" }
      ),
    };
  }

  if (
    ts.isTypeReferenceNode(unwrapped) &&
    ts.isIdentifier(unwrapped.typeName)
  ) {
    const declId = binding.resolveTypeReference(unwrapped);
    if (declId) {
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const decl = declInfo?.declNode as ts.Declaration | undefined;
      if (
        decl &&
        ts.isTypeAliasDeclaration(decl) &&
        ts.isConstructorTypeNode(decl.type)
      ) {
        return {
          kind: "tupleType",
          elementTypes: decl.type.parameters.map((param) =>
            param.type
              ? convertType(param.type, binding)
              : { kind: "unknownType" }
          ),
        };
      }
    }
  }

  if (ts.isTypeQueryNode(unwrapped) && ts.isIdentifier(unwrapped.exprName)) {
    const declId = binding.resolveIdentifier(unwrapped.exprName);
    if (!declId) return null;
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    const decl = declInfo?.declNode as ts.Declaration | undefined;
    if (!decl) return null;

    if (ts.isClassDeclaration(decl)) {
      const ctor = decl.members.find(ts.isConstructorDeclaration);
      const parameters = ctor?.parameters ?? [];
      return {
        kind: "tupleType",
        elementTypes: parameters.map((param) =>
          param.type
            ? convertType(param.type, binding)
            : { kind: "unknownType" }
        ),
      };
    }

    if (ts.isVariableDeclaration(decl) && decl.type) {
      return expandConstructorParameters(decl.type, binding, convertType);
    }
  }

  return null;
};

/**
 * Expand InstanceType<C> by extracting constructor instance result type.
 */
const expandInstanceType = (
  ctorArg: ts.TypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  if (isTypeParameterNode(ctorArg, binding)) {
    return null;
  }

  const unwrapped = unwrapParens(ctorArg);
  if (ts.isUnionTypeNode(unwrapped)) {
    const members: IrType[] = [];
    for (const member of flattenUnionTypeNodes(unwrapped)) {
      const expanded = expandInstanceType(member, binding, convertType);
      if (!expanded) return null;
      members.push(expanded);
    }
    if (members.length === 0) return { kind: "neverType" };
    if (members.length === 1) return members[0] ?? { kind: "neverType" };
    return { kind: "unionType", types: members };
  }

  if (ts.isConstructorTypeNode(unwrapped)) {
    return unwrapped.type
      ? convertType(unwrapped.type, binding)
      : { kind: "unknownType" };
  }

  if (
    ts.isTypeReferenceNode(unwrapped) &&
    ts.isIdentifier(unwrapped.typeName)
  ) {
    const declId = binding.resolveTypeReference(unwrapped);
    if (declId) {
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const decl = declInfo?.declNode as ts.Declaration | undefined;
      if (
        decl &&
        ts.isTypeAliasDeclaration(decl) &&
        ts.isConstructorTypeNode(decl.type)
      ) {
        return decl.type.type
          ? convertType(decl.type.type, binding)
          : { kind: "unknownType" };
      }
    }
  }

  if (ts.isTypeQueryNode(unwrapped) && ts.isIdentifier(unwrapped.exprName)) {
    const declId = binding.resolveIdentifier(unwrapped.exprName);
    if (!declId) return null;
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    const decl = declInfo?.declNode as ts.Declaration | undefined;
    if (!decl) return null;

    if (ts.isClassDeclaration(decl)) {
      if (!decl.name) return { kind: "unknownType" };
      return { kind: "referenceType", name: decl.name.text };
    }

    if (ts.isVariableDeclaration(decl) && decl.type) {
      return expandInstanceType(decl.type, binding, convertType);
    }
  }

  return null;
};

/**
 * Expand a conditional utility type (NonNullable, Exclude, Extract) to IR.
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Uses AST-based syntactic algorithms only. No getTypeAtLocation or typeToTypeNode.
 *
 * @param node - The TypeReferenceNode for the utility type
 * @param typeName - The name of the utility type (NonNullable, Exclude, Extract, etc.)
 * @param binding - The Binding layer for symbol resolution
 * @param convertType - Function to convert nested types
 * @returns IR type with the expanded result, or null if expansion fails
 */
export const expandConditionalUtilityType = (
  node: ts.TypeReferenceNode,
  typeName: string,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  return expandConditionalUtilityTypeInternal(
    node,
    typeName,
    binding,
    convertType,
    0
  );
};
