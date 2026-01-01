/**
 * Utility type expansion - Partial, Required, Readonly, Pick, Omit
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * These utility types are expanded using AST-based analysis only.
 * No banned APIs (getTypeAtLocation, getTypeOfSymbolAtLocation, typeToTypeNode).
 * Uses symbol resolution to find declarations and extracts types from TypeNodes.
 */

import * as ts from "typescript";
import {
  IrType,
  IrObjectType,
  IrPropertySignature,
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
]);

/**
 * Check if a type name is an expandable conditional utility type
 */
export const isExpandableConditionalUtilityType = (name: string): boolean =>
  EXPANDABLE_CONDITIONAL_UTILITY_TYPES.has(name);

/**
 * Resolve a type alias to its underlying TypeNode (AST-based, INV-0 compliant).
 * Follows type alias chains to get the actual type definition.
 *
 * @param node - The TypeNode to resolve
 * @param checker - The TypeScript type checker (for symbol resolution only)
 * @returns The resolved TypeNode, or the original if not a resolvable alias
 */
const resolveTypeAlias = (
  node: ts.TypeNode,
  checker: ts.TypeChecker
): ts.TypeNode => {
  // Only type references can be aliases
  if (!ts.isTypeReferenceNode(node)) return node;
  if (!ts.isIdentifier(node.typeName)) return node;

  // Get the symbol for the type reference
  const symbol = checker.getSymbolAtLocation(node.typeName);
  if (!symbol) return node;

  // If it's an aliased symbol, get the aliased symbol
  const resolvedSymbol =
    (symbol.flags & ts.SymbolFlags.Alias) !== 0
      ? checker.getAliasedSymbol(symbol)
      : symbol;

  const decls = resolvedSymbol.getDeclarations();
  if (!decls || decls.length === 0) return node;

  // Look for a type alias declaration
  const typeAliasDecl = decls.find(ts.isTypeAliasDeclaration);
  if (!typeAliasDecl) return node;

  // Recursively resolve in case of chained aliases
  return resolveTypeAlias(typeAliasDecl.type, checker);
};

/**
 * Check if a TypeNode is a type parameter reference (symbol-based, INV-0 compliant)
 */
const isTypeParameterNode = (
  node: ts.TypeNode,
  checker: ts.TypeChecker
): boolean => {
  if (!ts.isTypeReferenceNode(node)) return false;
  if (!ts.isIdentifier(node.typeName)) return false;

  const symbol = checker.getSymbolAtLocation(node.typeName);
  if (!symbol) return false;

  const decls = symbol.getDeclarations();
  return decls?.some(ts.isTypeParameterDeclaration) ?? false;
};

/**
 * Extract members from an interface or type alias declaration (AST-based).
 * Used for utility type expansion.
 */
const extractMembersFromDeclaration = (
  decl: ts.Declaration,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): readonly IrInterfaceMember[] | null => {
  // Get type elements from declaration
  const typeElements = ts.isInterfaceDeclaration(decl)
    ? decl.members
    : ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type)
      ? decl.type.members
      : undefined;

  if (!typeElements) {
    return null;
  }

  // Check for index signatures - can't expand these
  for (const member of typeElements) {
    if (ts.isIndexSignatureDeclaration(member)) {
      return null;
    }
  }

  const members: IrInterfaceMember[] = [];

  for (const member of typeElements) {
    if (ts.isPropertySignature(member)) {
      const propName = ts.isIdentifier(member.name)
        ? member.name.text
        : ts.isStringLiteral(member.name)
          ? member.name.text
          : undefined;

      if (!propName || !member.type) {
        continue; // Skip computed keys or untyped properties
      }

      const isOptional = !!member.questionToken;
      const isReadonly =
        member.modifiers?.some(
          (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
        ) ?? false;

      members.push({
        kind: "propertySignature",
        name: propName,
        type: convertType(member.type, checker),
        isOptional,
        isReadonly,
      });
    }

    if (ts.isMethodSignature(member)) {
      const methodName = ts.isIdentifier(member.name)
        ? member.name.text
        : undefined;

      if (!methodName) {
        continue; // Skip computed keys
      }

      members.push({
        kind: "methodSignature",
        name: methodName,
        parameters: member.parameters.map((param, index) => ({
          kind: "parameter" as const,
          pattern: {
            kind: "identifierPattern" as const,
            name: ts.isIdentifier(param.name) ? param.name.text : `arg${index}`,
          },
          type: param.type ? convertType(param.type, checker) : undefined,
          isOptional: !!param.questionToken,
          isRest: !!param.dotDotDotToken,
          passing: "value" as const,
        })),
        returnType: member.type ? convertType(member.type, checker) : undefined,
      });
    }
  }

  return members.length > 0 ? members : null;
};

/**
 * Extract literal keys from a TypeNode (AST-based).
 * Returns null if the type contains non-literal constituents or is a type parameter.
 */
const extractLiteralKeysFromTypeNode = (
  node: ts.TypeNode,
  checker: ts.TypeChecker
): Set<string> | null => {
  // Check for type parameter
  if (isTypeParameterNode(node, checker)) {
    return null;
  }

  // Handle string literal: "foo"
  if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) {
    return new Set([node.literal.text]);
  }

  // Handle number literal: 1
  if (ts.isLiteralTypeNode(node) && ts.isNumericLiteral(node.literal)) {
    return new Set([node.literal.text]);
  }

  // Handle union: "a" | "b" | "c"
  if (ts.isUnionTypeNode(node)) {
    const keys = new Set<string>();
    for (const member of node.types) {
      if (ts.isLiteralTypeNode(member)) {
        if (ts.isStringLiteral(member.literal)) {
          keys.add(member.literal.text);
        } else if (ts.isNumericLiteral(member.literal)) {
          keys.add(member.literal.text);
        } else {
          return null; // Non-string/number literal
        }
      } else {
        return null; // Non-literal in union
      }
    }
    return keys;
  }

  // String keyword - infinite set, can't expand
  if (node.kind === ts.SyntaxKind.StringKeyword) {
    return null;
  }

  // Number keyword - infinite set, can't expand
  if (node.kind === ts.SyntaxKind.NumberKeyword) {
    return null;
  }

  return null; // Not supported
};

/**
 * Expand a mapped utility type to an IrObjectType.
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Uses AST-based analysis only. Gets members from type declarations,
 * not from ts.Type resolution.
 *
 * @param node - The TypeReferenceNode for the utility type
 * @param typeName - The name of the utility type (Partial, Required, etc.)
 * @param checker - The TypeScript type checker (for symbol resolution only)
 * @param convertType - Function to convert nested types
 * @returns IrObjectType with the expanded properties, or null if expansion fails
 */
export const expandUtilityType = (
  node: ts.TypeReferenceNode,
  typeName: string,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrObjectType | null => {
  const debug = !!process.env.DEBUG_UTILITY;
  if (debug) console.log(`[UTILITY] Expanding ${typeName}`);

  const typeArgs = node.typeArguments;
  if (!typeArgs || typeArgs.length === 0) {
    if (debug) console.log(`[UTILITY] No type args`);
    return null;
  }

  // Get the target type argument (first argument for all mapped utilities)
  const targetArg = typeArgs[0];
  if (!targetArg) {
    if (debug) console.log(`[UTILITY] No target arg`);
    return null;
  }

  // Check if target is a type parameter (can't expand generics)
  if (isTypeParameterNode(targetArg, checker)) {
    if (debug) console.log(`[UTILITY] Target is type param`);
    return null;
  }

  // For Pick/Omit, check if the keys argument is a type parameter
  if ((typeName === "Pick" || typeName === "Omit") && typeArgs.length >= 2) {
    const keysArg = typeArgs[1];
    if (keysArg && isTypeParameterNode(keysArg, checker)) {
      if (debug) console.log(`[UTILITY] Keys is type param`);
      return null;
    }
  }

  // Get base members - either from declaration or from recursive expansion
  let baseMembers: readonly IrInterfaceMember[] | null = null;

  // Get the target type's declaration
  if (!ts.isTypeReferenceNode(targetArg)) {
    // Only support named type references (not inline object types)
    if (debug)
      console.log(
        `[UTILITY] Target not TypeRef: ${ts.SyntaxKind[targetArg.kind]}`
      );
    return null;
  }

  const targetName = ts.isIdentifier(targetArg.typeName)
    ? targetArg.typeName.text
    : undefined;
  if (!targetName) {
    if (debug) console.log(`[UTILITY] No target name`);
    return null;
  }
  if (debug) console.log(`[UTILITY] Target: ${targetName}`);

  // Check if target is itself a utility type (nested utility types)
  if (isExpandableUtilityType(targetName) && targetArg.typeArguments?.length) {
    // Recursively expand the inner utility type first
    const innerExpanded = expandUtilityType(
      targetArg,
      targetName,
      checker,
      convertType
    );
    if (innerExpanded) {
      if (debug)
        console.log(
          `[UTILITY] Recursively expanded ${targetName}, got ${innerExpanded.members.length} members`
        );
      baseMembers = innerExpanded.members;
    } else {
      if (debug)
        console.log(`[UTILITY] Recursive expansion of ${targetName} failed`);
      return null;
    }
  } else {
    // Not a utility type, resolve from declaration
    const symbol = checker.getSymbolAtLocation(targetArg.typeName);
    if (!symbol) {
      if (debug) console.log(`[UTILITY] No symbol for ${targetName}`);
      return null;
    }

    const decls = symbol.getDeclarations();
    if (!decls || decls.length === 0) {
      if (debug) console.log(`[UTILITY] No declarations`);
      return null;
    }
    if (debug)
      console.log(
        `[UTILITY] Found ${decls.length} declarations: ${decls.map((d) => ts.SyntaxKind[d.kind]).join(", ")}`
      );

    // Find interface or type alias declaration
    const decl = decls.find(
      (d) => ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d)
    );
    if (!decl) {
      if (debug) console.log(`[UTILITY] No interface/type alias decl`);
      return null;
    }

    // Extract members from declaration (AST-based)
    baseMembers = extractMembersFromDeclaration(decl, checker, convertType);
    if (!baseMembers) {
      if (debug)
        console.log(`[UTILITY] extractMembersFromDeclaration returned null`);
      return null;
    }
    if (debug) console.log(`[UTILITY] Extracted ${baseMembers.length} members`);
  }

  if (!baseMembers) {
    return null;
  }

  // Handle Pick/Omit - filter members by keys
  if (typeName === "Pick" || typeName === "Omit") {
    const keysArg = typeArgs[1];
    if (!keysArg) {
      return null;
    }

    const keys = extractLiteralKeysFromTypeNode(keysArg, checker);
    if (!keys) {
      return null; // Can't extract literal keys
    }

    const filteredMembers = baseMembers.filter((m) => {
      const include =
        typeName === "Pick" ? keys.has(m.name) : !keys.has(m.name);
      return include;
    });

    return { kind: "objectType", members: filteredMembers };
  }

  // Apply Partial/Required/Readonly transformations
  const transformedMembers = baseMembers.map((m): IrInterfaceMember => {
    if (m.kind === "propertySignature") {
      const isOptional =
        typeName === "Partial"
          ? true
          : typeName === "Required"
            ? false
            : m.isOptional;
      const isReadonly = typeName === "Readonly" ? true : m.isReadonly;

      return {
        ...m,
        isOptional,
        isReadonly,
      };
    }
    return m;
  });

  return { kind: "objectType", members: transformedMembers };
};

/**
 * Check if a TypeNode recursively contains type parameters.
 * Uses symbol-based checks only (INV-0 compliant).
 */
const typeNodeContainsTypeParameter = (
  node: ts.TypeNode,
  checker: ts.TypeChecker
): boolean => {
  if (isTypeParameterNode(node, checker)) {
    return true;
  }

  if (ts.isUnionTypeNode(node)) {
    return node.types.some((t) => typeNodeContainsTypeParameter(t, checker));
  }

  if (ts.isIntersectionTypeNode(node)) {
    return node.types.some((t) => typeNodeContainsTypeParameter(t, checker));
  }

  if (ts.isArrayTypeNode(node)) {
    return typeNodeContainsTypeParameter(node.elementType, checker);
  }

  if (ts.isTypeReferenceNode(node) && node.typeArguments) {
    return node.typeArguments.some((t) =>
      typeNodeContainsTypeParameter(t, checker)
    );
  }

  return false;
};

/**
 * Serialize a TypeNode to a stable string for comparison.
 * Used by Exclude/Extract to compare type constituents.
 */
const serializeTypeNode = (node: ts.TypeNode): string => {
  if (node.kind === ts.SyntaxKind.StringKeyword) return "string";
  if (node.kind === ts.SyntaxKind.NumberKeyword) return "number";
  if (node.kind === ts.SyntaxKind.BooleanKeyword) return "boolean";
  if (node.kind === ts.SyntaxKind.NullKeyword) return "null";
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) return "undefined";
  if (node.kind === ts.SyntaxKind.NeverKeyword) return "never";
  if (node.kind === ts.SyntaxKind.AnyKeyword) return "any";
  if (node.kind === ts.SyntaxKind.UnknownKeyword) return "unknown";
  if (ts.isLiteralTypeNode(node)) {
    if (ts.isStringLiteral(node.literal)) return `"${node.literal.text}"`;
    if (ts.isNumericLiteral(node.literal)) return node.literal.text;
    if (node.literal.kind === ts.SyntaxKind.TrueKeyword) return "true";
    if (node.literal.kind === ts.SyntaxKind.FalseKeyword) return "false";
  }
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
    return `ref:${node.typeName.text}`;
  }
  // Fallback: use getText if available
  try {
    return node.getText();
  } catch {
    return "?";
  }
};

/**
 * Expand NonNullable<T> using syntactic filtering (INV-0 compliant).
 */
const expandNonNullable = (
  typeArg: ts.TypeNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType | null => {
  // Check for type parameter
  if (isTypeParameterNode(typeArg, checker)) {
    return null;
  }

  // Resolve type aliases to get the underlying type
  const resolved = resolveTypeAlias(typeArg, checker);

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
      return convertType(filtered[0], checker);
    }

    return {
      kind: "unionType",
      types: filtered.map((t) => convertType(t, checker)),
    };
  }

  // Not a union — return as-is (null/undefined are already filtered by check above)
  if (resolved.kind === ts.SyntaxKind.NullKeyword) return { kind: "neverType" };
  if (resolved.kind === ts.SyntaxKind.UndefinedKeyword)
    return { kind: "neverType" };

  return convertType(resolved, checker);
};

/**
 * Expand Exclude<T, U> or Extract<T, U> using syntactic filtering (INV-0 compliant).
 */
const expandExcludeExtract = (
  tArg: ts.TypeNode,
  uArg: ts.TypeNode,
  isExtract: boolean,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType | null => {
  // Check for type parameters
  if (typeNodeContainsTypeParameter(tArg, checker)) {
    return null;
  }
  if (typeNodeContainsTypeParameter(uArg, checker)) {
    return null;
  }

  // Resolve type aliases to get the underlying types
  const resolvedT = resolveTypeAlias(tArg, checker);
  const resolvedU = resolveTypeAlias(uArg, checker);

  // Only supported for union types
  if (!ts.isUnionTypeNode(resolvedT)) {
    // Single type: check if it matches U
    const uTypes = ts.isUnionTypeNode(resolvedU)
      ? resolvedU.types
      : [resolvedU];
    const tSerialized = serializeTypeNode(resolvedT);
    const matches = uTypes.some((u) => serializeTypeNode(u) === tSerialized);

    if (isExtract) {
      return matches ? convertType(resolvedT, checker) : { kind: "neverType" };
    } else {
      return matches ? { kind: "neverType" } : convertType(resolvedT, checker);
    }
  }

  // T is a union - filter its constituents
  const uTypes = ts.isUnionTypeNode(resolvedU) ? resolvedU.types : [resolvedU];
  const uSet = new Set(uTypes.map((t) => serializeTypeNode(t)));

  const filtered = resolvedT.types.filter((t) => {
    const matches = uSet.has(serializeTypeNode(t));
    return isExtract ? matches : !matches;
  });

  if (filtered.length === 0) return { kind: "neverType" };
  if (filtered.length === 1 && filtered[0]) {
    return convertType(filtered[0], checker);
  }

  return {
    kind: "unionType",
    types: filtered.map((t) => convertType(t, checker)),
  };
};

/**
 * Expand ReturnType<F> by extracting from function type declaration (INV-0 compliant).
 */
const expandReturnType = (
  fArg: ts.TypeNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType | null => {
  // Check for type parameter
  if (isTypeParameterNode(fArg, checker)) {
    return null;
  }

  // Case 1: Direct function type node
  if (ts.isFunctionTypeNode(fArg)) {
    return fArg.type ? convertType(fArg.type, checker) : { kind: "voidType" };
  }

  // Case 2: Type reference to function type alias
  if (ts.isTypeReferenceNode(fArg) && ts.isIdentifier(fArg.typeName)) {
    const symbol = checker.getSymbolAtLocation(fArg.typeName);
    const decl = symbol?.getDeclarations()?.[0];
    if (
      decl &&
      ts.isTypeAliasDeclaration(decl) &&
      ts.isFunctionTypeNode(decl.type)
    ) {
      return decl.type.type
        ? convertType(decl.type.type, checker)
        : { kind: "voidType" };
    }
  }

  return null; // Can't extract return type
};

/**
 * Expand Parameters<F> by extracting from function type declaration (INV-0 compliant).
 */
const expandParameters = (
  fArg: ts.TypeNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType | null => {
  // Check for type parameter
  if (isTypeParameterNode(fArg, checker)) {
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
    const symbol = checker.getSymbolAtLocation(fArg.typeName);
    const decl = symbol?.getDeclarations()?.[0];
    if (
      decl &&
      ts.isTypeAliasDeclaration(decl) &&
      ts.isFunctionTypeNode(decl.type)
    ) {
      functionType = decl.type;
    }
  }

  if (!functionType) {
    return null; // Can't extract parameters
  }

  // Build tuple type from parameters
  const paramTypes: IrType[] = functionType.parameters.map((param) =>
    param.type ? convertType(param.type, checker) : { kind: "anyType" }
  );

  return { kind: "tupleType", elementTypes: paramTypes };
};

/**
 * Expand Awaited<T> by extracting from Promise type parameter (INV-0 compliant).
 */
const expandAwaited = (
  tArg: ts.TypeNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType | null => {
  // Check for type parameter
  if (isTypeParameterNode(tArg, checker)) {
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
          expandAwaited(innerArg, checker, convertType) ??
          convertType(innerArg, checker)
        );
      }
    }
  }

  // Not a Promise type - return as-is
  return convertType(tArg, checker);
};

/**
 * Expand a conditional utility type (NonNullable, Exclude, Extract) to IR.
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Uses AST-based syntactic algorithms only. No getTypeAtLocation or typeToTypeNode.
 *
 * @param node - The TypeReferenceNode for the utility type
 * @param typeName - The name of the utility type (NonNullable, Exclude, Extract, etc.)
 * @param checker - The TypeScript type checker (for symbol resolution only)
 * @param convertType - Function to convert nested types
 * @returns IR type with the expanded result, or null if expansion fails
 */
export const expandConditionalUtilityType = (
  node: ts.TypeReferenceNode,
  typeName: string,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType | null => {
  const typeArgs = node.typeArguments;
  if (!typeArgs || typeArgs.length === 0) {
    return null;
  }

  // Check for type parameters in any argument
  for (const typeArg of typeArgs) {
    if (typeNodeContainsTypeParameter(typeArg, checker)) {
      return null;
    }
  }

  const firstArg = typeArgs[0];
  if (!firstArg) {
    return null;
  }

  switch (typeName) {
    case "NonNullable":
      return expandNonNullable(firstArg, checker, convertType);

    case "Exclude": {
      const secondArg = typeArgs[1];
      if (!secondArg) return null;
      return expandExcludeExtract(
        firstArg,
        secondArg,
        false,
        checker,
        convertType
      );
    }

    case "Extract": {
      const secondArg = typeArgs[1];
      if (!secondArg) return null;
      return expandExcludeExtract(
        firstArg,
        secondArg,
        true,
        checker,
        convertType
      );
    }

    case "ReturnType":
      return expandReturnType(firstArg, checker, convertType);

    case "Parameters":
      return expandParameters(firstArg, checker, convertType);

    case "Awaited":
      return expandAwaited(firstArg, checker, convertType);

    default:
      return null;
  }
};

/**
 * Expand Record<K, T> to IrObjectType when K is a finite set of literal keys.
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Uses AST-based analysis only. Extracts literal keys from TypeNode,
 * not from ts.Type.
 *
 * Gating conditions:
 * - Returns null if K contains type parameters (generic context)
 * - Returns null if K is string or number (should remain IrDictionaryType)
 * - Returns null if K contains non-literal types
 *
 * Examples:
 * - Record<"a" | "b", number> → IrObjectType with props {a: number, b: number}
 * - Record<1 | 2, string> → IrObjectType with props {"1": string, "2": string}
 * - Record<string, number> → null (use IrDictionaryType)
 * - Record<K, T> → null (type parameter)
 *
 * @param node - The TypeReferenceNode for Record<K, T>
 * @param checker - The TypeScript type checker (for symbol resolution only)
 * @param convertType - Function to convert nested types
 * @returns IrObjectType with the expanded properties, or null if should use dictionary
 */
export const expandRecordType = (
  node: ts.TypeReferenceNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrObjectType | null => {
  const typeArgs = node.typeArguments;
  if (!typeArgs || typeArgs.length !== 2) {
    return null;
  }

  const keyTypeNode = typeArgs[0];
  const valueTypeNode = typeArgs[1];

  if (!keyTypeNode || !valueTypeNode) {
    return null;
  }

  // Check for type parameters in key (AST-based)
  if (typeNodeContainsTypeParameter(keyTypeNode, checker)) {
    return null;
  }

  // Check for type parameters in value (AST-based)
  if (typeNodeContainsTypeParameter(valueTypeNode, checker)) {
    return null;
  }

  // Try to extract finite literal keys (AST-based)
  const literalKeys = extractLiteralKeysFromTypeNode(keyTypeNode, checker);
  if (literalKeys === null || literalKeys.size === 0) {
    // Not a finite set of literals - use IrDictionaryType
    return null;
  }

  // Convert the value type
  const irValueType = convertType(valueTypeNode, checker);

  // Build IrObjectType with a property for each key
  // Prefix numeric keys with '_' to make them valid C# identifiers
  const members: IrPropertySignature[] = Array.from(literalKeys).map((key) => ({
    kind: "propertySignature" as const,
    name: /^\d/.test(key) ? `_${key}` : key,
    type: irValueType,
    isOptional: false,
    isReadonly: false,
  }));

  return { kind: "objectType", members };
};
