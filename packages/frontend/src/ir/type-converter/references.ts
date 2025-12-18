/**
 * Reference type conversion
 */

import * as ts from "typescript";
import {
  IrType,
  IrDictionaryType,
  IrInterfaceMember,
  IrPropertySignature,
  IrMethodSignature,
} from "../types.js";
import {
  isPrimitiveTypeName,
  getPrimitiveType,
  isClrPrimitiveTypeName,
  getClrPrimitiveType,
  CLR_PRIMITIVE_TYPE_SET,
} from "./primitives.js";
import {
  isExpandableUtilityType,
  expandUtilityType,
  isExpandableConditionalUtilityType,
  expandConditionalUtilityType,
  expandRecordType,
} from "./utility-types.js";

/**
 * Cache for structural member extraction to prevent infinite recursion
 * on recursive types like `type Node = { next: Node }`.
 *
 * Key: ts.Type (by identity)
 * Value: extracted members, null (not extractable), or "in-progress" sentinel
 */
const structuralMembersCache = new WeakMap<
  ts.Type,
  readonly IrInterfaceMember[] | null | "in-progress"
>();

/**
 * Check if a type should have structural members extracted.
 *
 * Only extract for:
 * - Interfaces (InterfaceDeclaration)
 * - Type aliases to object types (TypeAliasDeclaration)
 *
 * Do NOT extract for:
 * - Classes (have implementation, not just shape)
 * - Enums, namespaces
 * - Library types (from node_modules or lib.*.d.ts)
 * - CLR interop types
 * - Union/intersection types (ambiguous property semantics)
 */
const shouldExtractStructuralMembers = (
  resolvedType: ts.Type,
  _checker: ts.TypeChecker
): boolean => {
  // Don't extract for type parameters
  if (resolvedType.flags & ts.TypeFlags.TypeParameter) {
    return false;
  }

  // Don't extract for union types (ambiguous property semantics)
  if (resolvedType.isUnion()) {
    return false;
  }

  // Don't extract for intersection types (conservative)
  if (resolvedType.isIntersection()) {
    return false;
  }

  // Check the symbol to determine if this is a structural type we should extract
  const symbol = resolvedType.getSymbol();
  if (!symbol) {
    return false;
  }

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return false;
  }

  // Check if ANY declaration is from a library file (node_modules or lib.*.d.ts)
  for (const decl of declarations) {
    const sourceFile = decl.getSourceFile();
    const fileName = sourceFile.fileName;

    // Skip library types
    if (
      fileName.includes("node_modules") ||
      fileName.includes("lib.") ||
      sourceFile.isDeclarationFile
    ) {
      return false;
    }
  }

  // Check the first declaration to determine type
  const firstDecl = declarations[0];
  if (!firstDecl) {
    return false;
  }

  // Only extract for interfaces and type aliases
  if (ts.isInterfaceDeclaration(firstDecl)) {
    return true;
  }

  if (ts.isTypeAliasDeclaration(firstDecl)) {
    // Only extract if the alias resolves to an object-like type
    // (has properties, not a primitive/union/etc)
    const properties = resolvedType.getProperties();
    return properties !== undefined && properties.length > 0;
  }

  // TypeLiteral: When a type alias resolves to an object type like `type Config = { x: number }`,
  // TypeScript's getTypeAtLocation returns the underlying object type, whose declaration is TypeLiteral.
  // We need to extract structural members in this case too.
  if (ts.isTypeLiteralNode(firstDecl)) {
    const properties = resolvedType.getProperties();
    return properties !== undefined && properties.length > 0;
  }

  // Don't extract for classes, enums, etc.
  return false;
};

/**
 * Extract structural members from a resolved type.
 *
 * Used to populate structuralMembers on referenceType for interfaces and type aliases.
 * This enables TSN5110 validation for object literal properties against expected types.
 *
 * Safety guards:
 * - Only extracts for interfaces/type-aliases (not classes, enums, lib types)
 * - Uses cache to prevent infinite recursion on recursive types
 * - Skips unsupported keys instead of bailing entirely
 * - Returns undefined for union/intersection (conservative)
 * - Returns undefined for index signatures (can't fully represent)
 *
 * @param resolvedType - The resolved TypeScript type
 * @param node - The enclosing node for type-to-node conversion
 * @param checker - The TypeScript type checker
 * @param convertType - Function to convert nested types
 * @returns Structural members or undefined if extraction fails/skipped
 */
const extractStructuralMembers = (
  resolvedType: ts.Type,
  node: ts.Node,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): readonly IrInterfaceMember[] | undefined => {
  // Check cache first (handles recursion)
  const cached = structuralMembersCache.get(resolvedType);
  if (cached === "in-progress") {
    // Recursive reference - return undefined to break cycle
    return undefined;
  }
  if (cached !== undefined) {
    return cached === null ? undefined : cached;
  }

  // Gate: only extract for structural types we own
  if (!shouldExtractStructuralMembers(resolvedType, checker)) {
    structuralMembersCache.set(resolvedType, null);
    return undefined;
  }

  // Mark as in-progress before recursing.
  // IMPORTANT: Use try/finally to ensure cache is always settled.
  // If typeToTypeNode() or convertType() throws, we must not leave
  // "in-progress" in the cache (would cause future lookups to fail).
  structuralMembersCache.set(resolvedType, "in-progress");

  try {
    // Get properties
    const properties = resolvedType.getProperties();
    if (!properties || properties.length === 0) {
      structuralMembersCache.set(resolvedType, null);
      return undefined;
    }

    // Check for index signatures - can't fully represent these structurally
    const stringIndexType = checker.getIndexInfoOfType(
      resolvedType,
      ts.IndexKind.String
    );
    const numberIndexType = checker.getIndexInfoOfType(
      resolvedType,
      ts.IndexKind.Number
    );
    if (stringIndexType || numberIndexType) {
      structuralMembersCache.set(resolvedType, null);
      return undefined;
    }

    // Extract members
    const members: IrInterfaceMember[] = [];

    for (const prop of properties) {
      const propName = prop.getName();

      // Skip non-string keys (symbols, computed) - don't bail entirely
      if (propName.startsWith("__@") || propName.startsWith("[")) {
        continue; // Skip this property, keep extracting others
      }

      const propType = checker.getTypeOfSymbolAtLocation(prop, node);
      const declarations = prop.getDeclarations();

      // Check optional/readonly
      const isOptional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
      const isReadonly =
        declarations?.some((decl) => {
          if (ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl)) {
            return (
              decl.modifiers?.some(
                (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
              ) ?? false
            );
          }
          return false;
        }) ?? false;

      // Check if it's a method
      const isMethod =
        declarations?.some(
          (decl) => ts.isMethodSignature(decl) || ts.isMethodDeclaration(decl)
        ) ?? false;

      // IMPORTANT: Check for CLR primitive type aliases BEFORE calling typeToTypeNode.
      // TypeScript eagerly resolves type aliases like `int` to their underlying type `number`
      // when converting to TypeNode. We need to preserve the alias identity for CLR primitives
      // so that TSN5110 correctly validates `int` properties accept `int` values.
      //
      // The propType.aliasSymbol approach doesn't work because getTypeOfSymbolAtLocation
      // returns the resolved type without alias info. Instead, we look at the property
      // declaration's type node directly to see the original type reference.
      //
      // Only preserve alias identity when:
      // 1. The type reference name is a known CLR primitive (e.g., "int")
      // 2. The type reference resolves to @tsonic/core (not a random user alias)
      const propDecl = declarations?.[0];
      if (
        propDecl &&
        (ts.isPropertySignature(propDecl) || ts.isPropertyDeclaration(propDecl))
      ) {
        const declTypeNode = propDecl.type;
        // Check if the declared type is a type reference to a CLR primitive
        if (declTypeNode && ts.isTypeReferenceNode(declTypeNode)) {
          const typeName = ts.isIdentifier(declTypeNode.typeName)
            ? declTypeNode.typeName.text
            : undefined;
          if (typeName && CLR_PRIMITIVE_TYPE_SET.has(typeName)) {
            // Resolve the type reference to check it comes from @tsonic/core
            // For type aliases like `int`, we need to get the symbol from the type name identifier
            // and follow any aliases (imports) to the original declaration
            const typeNameNode = declTypeNode.typeName;
            const typeSymbolRaw = ts.isIdentifier(typeNameNode)
              ? checker.getSymbolAtLocation(typeNameNode)
              : undefined;
            // Follow alias chain to get the original symbol (handles re-exports/imports)
            const typeSymbol = typeSymbolRaw
              ? checker.getAliasedSymbol(typeSymbolRaw)
              : undefined;
            const refDecl = typeSymbol?.declarations?.[0];
            const refSourceFile = refDecl?.getSourceFile();
            if (
              refSourceFile?.fileName.includes("@tsonic/core") ||
              refSourceFile?.fileName.includes("@tsonic/types")
            ) {
              // Directly emit the CLR primitive type, bypassing typeToTypeNode
              const propSig: IrPropertySignature = {
                kind: "propertySignature",
                name: propName,
                type: getClrPrimitiveType(typeName as "int"),
                isOptional,
                isReadonly,
              };
              members.push(propSig);
              continue;
            }
          }
        }
      }

      const typeNodeFlags = ts.NodeBuilderFlags.NoTruncation;
      const propTypeNode = checker.typeToTypeNode(
        propType,
        node,
        typeNodeFlags
      );

      if (isMethod && propTypeNode && ts.isFunctionTypeNode(propTypeNode)) {
        // Method signature
        const methSig: IrMethodSignature = {
          kind: "methodSignature",
          name: propName,
          parameters: propTypeNode.parameters.map((param, index) => ({
            kind: "parameter" as const,
            pattern: {
              kind: "identifierPattern" as const,
              name: ts.isIdentifier(param.name)
                ? param.name.text
                : `arg${index}`,
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
          name: propName,
          type: propTypeNode
            ? convertType(propTypeNode, checker)
            : { kind: "anyType" },
          isOptional,
          isReadonly,
        };
        members.push(propSig);
      }
    }

    const result = members.length > 0 ? members : undefined;
    structuralMembersCache.set(resolvedType, result ?? null);
    return result;
  } catch {
    // On any error, settle cache to null (not extractable)
    structuralMembersCache.set(resolvedType, null);
    return undefined;
  }
};

/**
 * Convert TypeScript type reference to IR type
 * Handles both primitive type names and user-defined types
 */
export const convertTypeReference = (
  node: ts.TypeReferenceNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType => {
  const typeName = ts.isIdentifier(node.typeName)
    ? node.typeName.text
    : node.typeName.getText();

  // Check for primitive type names
  if (isPrimitiveTypeName(typeName)) {
    return getPrimitiveType(typeName);
  }

  // Check for CLR primitive type names (e.g., int from @tsonic/core)
  // These are compiler-known types that map to distinct primitives, not referenceType
  if (isClrPrimitiveTypeName(typeName)) {
    return getClrPrimitiveType(typeName);
  }

  // Check for Array<T> utility type → convert to arrayType with explicit origin
  // This ensures Array<T> and T[] are treated identically
  const firstTypeArg = node.typeArguments?.[0];
  if (typeName === "Array" && firstTypeArg) {
    return {
      kind: "arrayType",
      elementType: convertType(firstTypeArg, checker),
      origin: "explicit",
    };
  }

  // Check for expandable conditional utility types (NonNullable, Exclude, Extract)
  // These are expanded at compile time by delegating to TypeScript's type checker
  if (
    isExpandableConditionalUtilityType(typeName) &&
    node.typeArguments?.length
  ) {
    const expanded = expandConditionalUtilityType(
      node,
      typeName,
      checker,
      convertType
    );
    if (expanded) return expanded;
    // Fall through to referenceType if can't expand (e.g., type parameter)
  }

  // Check for Record<K, V> utility type
  // First try to expand to IrObjectType for finite literal keys
  // Falls back to IrDictionaryType ONLY for string/number keys (not type parameters)
  const typeArgsForRecord = node.typeArguments;
  const keyTypeNode = typeArgsForRecord?.[0];
  const valueTypeNode = typeArgsForRecord?.[1];
  if (typeName === "Record" && keyTypeNode && valueTypeNode) {
    // Try to expand to IrObjectType for finite literal keys
    const expandedRecord = expandRecordType(node, checker, convertType);
    if (expandedRecord) return expandedRecord;

    // Only create dictionary if K is exactly 'string' or 'number'
    // Type parameters should fall through to referenceType
    //
    // NOTE: We check SyntaxKind FIRST because getTypeAtLocation fails on synthesized nodes
    // (from typeToTypeNode). For synthesized nodes like NumberKeyword, getTypeAtLocation
    // returns `any` instead of the correct type. Checking SyntaxKind handles both cases.
    const isStringKey =
      keyTypeNode.kind === ts.SyntaxKind.StringKeyword ||
      !!(checker.getTypeAtLocation(keyTypeNode).flags & ts.TypeFlags.String);
    const isNumberKey =
      keyTypeNode.kind === ts.SyntaxKind.NumberKeyword ||
      !!(checker.getTypeAtLocation(keyTypeNode).flags & ts.TypeFlags.Number);

    if (isStringKey || isNumberKey) {
      const keyType = convertType(keyTypeNode, checker);
      const valueType = convertType(valueTypeNode, checker);

      return {
        kind: "dictionaryType",
        keyType,
        valueType,
      } as IrDictionaryType;
    }
    // Type parameter or other complex key type - fall through to referenceType
  }

  // Check for expandable utility types (Partial, Required, Readonly, Pick, Omit)
  // These are expanded to IrObjectType at compile time for concrete types
  if (isExpandableUtilityType(typeName) && node.typeArguments?.length) {
    const expanded = expandUtilityType(node, typeName, checker, convertType);
    if (expanded) return expanded;
    // Fall through to referenceType if can't expand (e.g., type parameter)
  }

  // NOTE: ref<T>, out<T>, In<T> are no longer supported as types.
  // Parameter modifiers will be expressed via syntax in the future.
  // If someone uses ref<T> etc., it will fall through to referenceType
  // and the validation pass will reject it with a hard error.

  // Check if this is a type parameter reference (e.g., T in Container<T>)
  // Use the type checker to determine if the reference resolves to a type parameter
  const type = checker.getTypeAtLocation(node);
  if (type.flags & ts.TypeFlags.TypeParameter) {
    return { kind: "typeParameterType", name: typeName };
  }

  // Extract structural members for interfaces and type aliases.
  // This enables TSN5110 validation for object literal properties.
  const structuralMembers = extractStructuralMembers(
    type,
    node,
    checker,
    convertType
  );

  // Reference type (user-defined or library)
  return {
    kind: "referenceType",
    name: typeName,
    typeArguments: node.typeArguments?.map((t) => convertType(t, checker)),
    structuralMembers,
  };
};
