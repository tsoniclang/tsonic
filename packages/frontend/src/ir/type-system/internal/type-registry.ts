/**
 * TypeRegistry - Pure IR source of truth for type declarations
 *
 * ALICE'S SPEC (Step 3): This registry stores IrType (pure IR), NOT ts.TypeNode.
 * Types are converted at registration time, making queries deterministic.
 *
 * CANONICAL CLR IDENTITY: Well-known runtime types from compiler core globals,
 * Tsonic surface packages, @tsonic/core, and @tsonic/dotnet are registered
 * with canonical CLR FQ names
 * (e.g., String → System.String, String$instance → System.String$instance).
 *
 * Part of Alice's specification for deterministic IR typing.
 */

import * as ts from "typescript";
import type {
  IrType,
  IrMethodSignature,
  IrInterfaceMember,
} from "../../types/index.js";
import { getNamespaceFromPath } from "../../../resolver/namespace.js";
import { normalizeToClrName } from "./universe/alias-table.js";

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL CLR NAME HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a source file is from a well-known Tsonic library.
 * These libraries contain runtime types that need canonical CLR FQ names.
 */
const isWellKnownLibrary = (fileName: string): boolean => {
  return (
    fileName.includes("__core_globals__.d.ts") ||
    fileName.includes("@tsonic/globals") ||
    fileName.includes("@tsonic/js") ||
    fileName.includes("@tsonic/nodejs") ||
    fileName.includes("@tsonic/core") ||
    fileName.includes("@tsonic/dotnet")
  );
};

/**
 * Get the canonical CLR FQ name for a type from a well-known library.
 * Returns undefined if the type should use its default FQ name.
 *
 * Handles:
 * - Global types: String → System.String, Array → System.Array
 * - $instance companions: String$instance → System.String$instance
 * - Core primitives: int → System.Int32, etc. (handled via type aliases)
 */
const getCanonicalClrFQName = (
  simpleName: string,
  isFromWellKnownLib: boolean
): string | undefined => {
  if (!isFromWellKnownLib) return undefined;

  // Check direct mapping (String, Array, Number, etc.)
  const directMapping = normalizeToClrName(simpleName);
  if (directMapping !== simpleName) return directMapping;

  // Handle $instance companions - they map to System.X$instance
  if (simpleName.endsWith("$instance")) {
    const baseName = simpleName.slice(0, -9); // Remove "$instance"
    const baseClrName = normalizeToClrName(baseName);
    if (baseClrName !== baseName) {
      return `${baseClrName}$instance`;
    }
  }

  // Handle __X$views companions - they map to System.X$views
  if (simpleName.includes("$views")) {
    const baseName = simpleName.replace("__", "").replace("$views", "");
    const baseClrName = normalizeToClrName(baseName);
    if (baseClrName !== baseName) {
      return `${baseClrName}$views`;
    }
  }

  return undefined;
};

// ═══════════════════════════════════════════════════════════════════════════
// PURE IR TYPES (Alice's Spec)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Information about a type member (property or method) - PURE IR
 */
export type MemberInfo = {
  readonly kind: "property" | "method" | "indexSignature";
  readonly name: string;
  readonly type: IrType | undefined; // PURE IR - converted at registration time
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
  readonly methodSignatures?: readonly IrMethodSignature[]; // For methods - PURE IR
};

/**
 * Heritage clause information (extends/implements) - PURE IR
 */
export type HeritageInfo = {
  readonly kind: "extends" | "implements";
  readonly baseType: IrType; // PURE IR - converted at registration time
  readonly typeName: string; // The resolved type name
};

/**
 * Type parameter info for generic types - PURE IR
 */
export type TypeParameterEntry = {
  readonly name: string;
  readonly constraint?: IrType; // PURE IR
  readonly defaultType?: IrType; // PURE IR
};

/**
 * Entry for a nominal type (class, interface, type alias) - PURE IR
 *
 * NOTE: No ts.Declaration, ts.SourceFile, or ts.TypeNode fields.
 */
export type TypeRegistryEntry = {
  readonly kind: "class" | "interface" | "typeAlias";
  readonly name: string; // Simple name (e.g., "User")
  readonly fullyQualifiedName: string; // FQ name (e.g., "MyApp.Models.User")
  readonly isDeclarationFile: boolean;
  readonly typeParameters: readonly TypeParameterEntry[]; // PURE IR
  readonly members: ReadonlyMap<string, MemberInfo>; // PURE IR
  readonly heritage: readonly HeritageInfo[]; // PURE IR
  readonly aliasedType?: IrType; // For type aliases - the aliased type (PURE IR)
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPEREISTRY API (Pure IR)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * TypeRegistry API - returns pure IR types
 */
export type TypeRegistry = {
  /**
   * Resolve a type by fully-qualified name. Returns undefined if not found.
   */
  readonly resolveNominal: (fqName: string) => TypeRegistryEntry | undefined;

  /**
   * Resolve a type by simple name.
   * Returns first match if multiple types have the same simple name.
   */
  readonly resolveBySimpleName: (
    simpleName: string
  ) => TypeRegistryEntry | undefined;

  /**
   * Get the fully-qualified name for a simple name.
   * Returns undefined if not found.
   */
  readonly getFQName: (simpleName: string) => string | undefined;

  /**
   * Get a member's type from a nominal type (by FQ name).
   * Returns pure IrType - no TypeNode access needed.
   */
  readonly getMemberType: (
    fqNominal: string,
    memberName: string
  ) => IrType | undefined;

  /**
   * Get all heritage clauses for a nominal type (by FQ name).
   * Returns pure IrType heritage info.
   */
  readonly getHeritageTypes: (fqNominal: string) => readonly HeritageInfo[];

  /**
   * Get all registered type names (fully-qualified).
   */
  readonly getAllTypeNames: () => readonly string[];

  /**
   * Check if a type name is registered (by FQ name).
   */
  readonly hasType: (fqName: string) => boolean;
};

/**
 * Type conversion function - converts TypeNode to IrType
 */
export type ConvertTypeFn = (typeNode: ts.TypeNode) => IrType;

export type BuildTypeRegistryOptions = {
  readonly convertType?: ConvertTypeFn;
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract type parameters from a declaration
 */
const extractTypeParameters = (
  typeParams: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
  convertType: ConvertTypeFn
): readonly TypeParameterEntry[] => {
  if (!typeParams) return [];
  return typeParams.map((p) => ({
    name: p.name.text,
    constraint: p.constraint ? convertType(p.constraint) : undefined,
    defaultType: p.default ? convertType(p.default) : undefined,
  }));
};

/**
 * Get the name from a TypeNode (for heritage clauses)
 */
const getTypeNodeName = (typeNode: ts.TypeNode): string | undefined => {
  if (ts.isTypeReferenceNode(typeNode)) {
    if (ts.isIdentifier(typeNode.typeName)) {
      return typeNode.typeName.text;
    }
    if (ts.isQualifiedName(typeNode.typeName)) {
      return typeNode.typeName.getText();
    }
  }
  if (ts.isExpressionWithTypeArguments(typeNode)) {
    if (ts.isIdentifier(typeNode.expression)) {
      return typeNode.expression.text;
    }
  }
  return undefined;
};

/**
 * Resolve a heritage clause type name to the same fully-qualified form used by
 * TypeRegistry entries.
 *
 * This is required so UnifiedUniverse can build correct stableIds for inheritance
 * edges (projectName:fullyQualifiedName), enabling NominalEnv substitution through
 * inheritance chains.
 *
 * DETERMINISTIC: Uses symbol resolution only (no ts.Type queries).
 */
const resolveHeritageTypeName = (
  typeNode: ts.ExpressionWithTypeArguments,
  checker: ts.TypeChecker,
  sourceRoot: string,
  rootNamespace: string
): string | undefined => {
  const expr = typeNode.expression;

  const symbol = (() => {
    if (ts.isIdentifier(expr)) return checker.getSymbolAtLocation(expr);
    if (ts.isPropertyAccessExpression(expr)) {
      return checker.getSymbolAtLocation(expr.name);
    }
    return undefined;
  })();

  const resolvedSymbol =
    symbol && symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol;

  const decl = resolvedSymbol?.getDeclarations()?.[0];
  const sourceFile = decl?.getSourceFile();

  const simpleName = (() => {
    if (
      decl &&
      (ts.isClassDeclaration(decl) ||
        ts.isInterfaceDeclaration(decl) ||
        ts.isTypeAliasDeclaration(decl) ||
        ts.isEnumDeclaration(decl)) &&
      decl.name
    ) {
      return decl.name.text;
    }
    if (resolvedSymbol) return resolvedSymbol.getName();
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
    return undefined;
  })();

  if (!simpleName) return undefined;

  // Canonicalize well-known runtime types to CLR FQ names.
  const canonical = getCanonicalClrFQName(
    simpleName,
    sourceFile ? isWellKnownLibrary(sourceFile.fileName) : false
  );
  if (canonical) return canonical;

  // Source-authored types use namespace-based FQ names.
  const ns =
    sourceFile && !sourceFile.isDeclarationFile
      ? getNamespaceFromPath(sourceFile.fileName, sourceRoot, rootNamespace)
      : undefined;

  return ns ? `${ns}.${simpleName}` : simpleName;
};

const stableTypeKey = (type: IrType): string => JSON.stringify(type);

const inferExpressionTypeSyntax = (
  expr: ts.Expression,
  convertType: ConvertTypeFn
): IrType | undefined => {
  let current = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }

  if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
    return convertType(current.type);
  }

  if (ts.isNonNullExpression(current)) {
    return inferExpressionTypeSyntax(current.expression, convertType);
  }

  if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
    return { kind: "primitiveType", name: "string" };
  }

  if (ts.isNumericLiteral(current)) {
    return { kind: "primitiveType", name: "number" };
  }

  if (
    current.kind === ts.SyntaxKind.TrueKeyword ||
    current.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return { kind: "primitiveType", name: "boolean" };
  }

  if (current.kind === ts.SyntaxKind.UndefinedKeyword) {
    return { kind: "primitiveType", name: "undefined" };
  }

  if (current.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "primitiveType", name: "null" };
  }

  if (ts.isArrayLiteralExpression(current)) {
    const elementTypes: IrType[] = [];
    for (const element of current.elements) {
      if (ts.isOmittedExpression(element) || ts.isSpreadElement(element)) {
        return undefined;
      }
      const elementType = inferExpressionTypeSyntax(element, convertType);
      if (!elementType) return undefined;
      elementTypes.push(elementType);
    }

    if (elementTypes.length === 0) return undefined;
    const first = elementTypes[0];
    if (
      first &&
      elementTypes.every(
        (candidate) => stableTypeKey(candidate) === stableTypeKey(first)
      )
    ) {
      return { kind: "arrayType", elementType: first };
    }

    return { kind: "tupleType", elementTypes };
  }

  if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
    const parameters = current.parameters.map((parameter, index) => ({
      kind: "parameter" as const,
      pattern: {
        kind: "identifierPattern" as const,
        name: ts.isIdentifier(parameter.name)
          ? parameter.name.text
          : `arg${index}`,
      },
      type: parameter.type ? convertType(parameter.type) : undefined,
      initializer: undefined,
      isOptional: !!parameter.questionToken,
      isRest: !!parameter.dotDotDotToken,
      passing: "value" as const,
    }));

    const returnType =
      current.type
        ? convertType(current.type)
        : ts.isBlock(current.body)
          ? (() => {
              const returns = current.body.statements.filter(ts.isReturnStatement);
              if (returns.length === 0) return { kind: "voidType" as const };
              const firstExpr = returns[0]?.expression;
              return firstExpr
                ? inferExpressionTypeSyntax(firstExpr, convertType)
                : ({ kind: "voidType" as const });
            })()
          : inferExpressionTypeSyntax(current.body, convertType);

    if (!returnType) return undefined;
    return {
      kind: "functionType",
      parameters,
      returnType,
    };
  }

  if (ts.isObjectLiteralExpression(current)) {
    const getPropertyName = (name: ts.PropertyName): string | undefined => {
      if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        return name.text;
      }
      if (
        ts.isComputedPropertyName(name) &&
        (ts.isStringLiteral(name.expression) ||
          ts.isNoSubstitutionTemplateLiteral(name.expression))
      ) {
        return name.expression.text;
      }
      return undefined;
    };

    const members: IrInterfaceMember[] = [];
    for (const property of current.properties) {
      if (ts.isSpreadAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
        return undefined;
      }

      if (ts.isPropertyAssignment(property)) {
        const name = getPropertyName(property.name);
        if (!name) return undefined;
        const propertyType = inferExpressionTypeSyntax(
          property.initializer,
          convertType
        );
        if (!propertyType) return undefined;
        members.push({
          kind: "propertySignature",
          name,
          type: propertyType,
          isOptional: false,
          isReadonly: false,
        });
        continue;
      }

      if (ts.isMethodDeclaration(property)) {
        const name = getPropertyName(property.name);
        if (!name) return undefined;
        const parameters = property.parameters.map((parameter, index) => ({
          kind: "parameter" as const,
          pattern: {
            kind: "identifierPattern" as const,
            name: ts.isIdentifier(parameter.name)
              ? parameter.name.text
              : `arg${index}`,
          },
          type: parameter.type ? convertType(parameter.type) : undefined,
          initializer: undefined,
          isOptional: !!parameter.questionToken,
          isRest: !!parameter.dotDotDotToken,
          passing: "value" as const,
        }));
        const returnType = property.type
          ? convertType(property.type)
          : property.body
            ? (() => {
                const returns = property.body.statements.filter(ts.isReturnStatement);
                if (returns.length === 0) return { kind: "voidType" as const };
                const firstExpr = returns[0]?.expression;
                return firstExpr
                  ? inferExpressionTypeSyntax(firstExpr, convertType)
                  : ({ kind: "voidType" as const });
              })()
            : undefined;
        if (!returnType) return undefined;
        members.push({
          kind: "methodSignature",
          name,
          parameters,
          returnType,
        });
        continue;
      }

      return undefined;
    }

    return { kind: "objectType", members };
  }

  return undefined;
};

const inferMemberType = (
  member:
    | ts.PropertyDeclaration
    | ts.GetAccessorDeclaration
    | ts.SetAccessorDeclaration,
  convertType: ConvertTypeFn
): IrType | undefined => {
  if ("type" in member && member.type) {
    return convertType(member.type);
  }

  if (ts.isPropertyDeclaration(member) && member.initializer) {
    return inferExpressionTypeSyntax(member.initializer, convertType);
  }

  if (ts.isGetAccessorDeclaration(member) && member.body) {
    const returns = member.body.statements.filter(ts.isReturnStatement);
    if (returns.length === 0) return undefined;
    const firstExpr = returns[0]?.expression;
    return firstExpr
      ? inferExpressionTypeSyntax(firstExpr, convertType)
      : undefined;
  }

  if (ts.isSetAccessorDeclaration(member)) {
    const valueParam = member.parameters[0];
    if (valueParam?.type) {
      return convertType(valueParam.type);
    }
  }

  return undefined;
};

/**
 * Extract member information from a class or interface - PURE IR version
 */
const extractMembers = (
  members: ts.NodeArray<ts.ClassElement> | ts.NodeArray<ts.TypeElement>,
  convertType: ConvertTypeFn
): ReadonlyMap<string, MemberInfo> => {
  const result = new Map<string, MemberInfo>();

  for (const member of members) {
    // Constructor parameter properties (class)
    // e.g., `constructor(public name: string, private password: string) {}`
    if (ts.isConstructorDeclaration(member)) {
      for (const param of member.parameters) {
        const isParameterProperty =
          param.modifiers?.some(
            (m) =>
              m.kind === ts.SyntaxKind.PublicKeyword ||
              m.kind === ts.SyntaxKind.PrivateKeyword ||
              m.kind === ts.SyntaxKind.ProtectedKeyword ||
              m.kind === ts.SyntaxKind.ReadonlyKeyword
          ) ?? false;

        if (!isParameterProperty) continue;
        if (!ts.isIdentifier(param.name)) continue;

        const name = param.name.text;
        // Parameter-property optionality must track `?` only.
        // A default initializer makes the constructor argument optional at call sites,
        // but the materialized class property is still always present.
        const isOptional = !!param.questionToken;
        const isReadonly =
          param.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
          ) ?? false;

        result.set(name, {
          kind: "property",
          name,
          type: param.type ? convertType(param.type) : undefined,
          isOptional,
          isReadonly,
        });
      }
    }

    // Property declarations (class)
    if (ts.isPropertyDeclaration(member)) {
      const name = member.name.getText();
      // Class-property optionality must track `?` only.
      // A field initializer does not make the property optional.
      const isOptional = member.questionToken !== undefined;
      const isReadonly = member.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
      );
      result.set(name, {
        kind: "property",
        name,
        type: inferMemberType(member, convertType),
        isOptional,
        isReadonly: isReadonly ?? false,
      });
    }

    // Property signatures (interface)
    if (ts.isPropertySignature(member)) {
      const name = member.name.getText();
      result.set(name, {
        kind: "property",
        name,
        type: member.type ? convertType(member.type) : undefined,
        isOptional: member.questionToken !== undefined,
        isReadonly:
          member.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
          ) ?? false,
      });
    }

    if (
      ts.isGetAccessorDeclaration(member) ||
      ts.isSetAccessorDeclaration(member)
    ) {
      const name = member.name.getText();
      const existing = result.get(name);
      result.set(name, {
        kind: "property",
        name,
        type: inferMemberType(member, convertType) ?? existing?.type,
        isOptional: false,
        isReadonly: ts.isSetAccessorDeclaration(member)
          ? false
          : (existing?.isReadonly ?? true),
      });
    }

    // Method declarations (class)
    if (ts.isMethodDeclaration(member)) {
      const name = member.name.getText();
      const existing = result.get(name);
      const newSig = convertMethodToSignature(member, convertType);
      const signatures = existing?.methodSignatures
        ? [...existing.methodSignatures, newSig]
        : [newSig];
      result.set(name, {
        kind: "method",
        name,
        type: undefined, // Methods have signatures, not a single type
        isOptional: member.questionToken !== undefined,
        isReadonly: false,
        methodSignatures: signatures,
      });
    }

    // Method signatures (interface)
    if (ts.isMethodSignature(member)) {
      const name = member.name.getText();
      const existing = result.get(name);
      const newSig = convertMethodSignatureToIr(member, convertType);
      const signatures = existing?.methodSignatures
        ? [...existing.methodSignatures, newSig]
        : [newSig];
      result.set(name, {
        kind: "method",
        name,
        type: undefined, // Methods have signatures, not a single type
        isOptional: member.questionToken !== undefined,
        isReadonly: false,
        methodSignatures: signatures,
      });
    }

    // Index signatures (interface)
    if (ts.isIndexSignatureDeclaration(member)) {
      const param = member.parameters[0];
      const keyType = param?.type;
      const keyName = keyType
        ? ts.isTypeReferenceNode(keyType)
          ? keyType.typeName.getText()
          : keyType.getText()
        : "unknown";
      const name = `[${keyName}]`;
      result.set(name, {
        kind: "indexSignature",
        name,
        type: member.type ? convertType(member.type) : undefined,
        isOptional: false,
        isReadonly:
          member.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
          ) ?? false,
      });
    }
  }

  return result;
};

/**
 * Extract members from an already-converted object type.
 *
 * This is used for object-like type aliases that expand deterministically to
 * `IrObjectType` during registration (e.g., `type StatusMap = Record<...>`).
 * Registering these members enables TypeSystem member lookups on aliased types.
 */
const extractMembersFromAliasedObjectType = (
  aliased: IrType
): ReadonlyMap<string, MemberInfo> => {
  if (aliased.kind !== "objectType") return new Map();

  const result = new Map<string, MemberInfo>();

  for (const member of aliased.members) {
    if (member.kind === "propertySignature") {
      result.set(member.name, {
        kind: "property",
        name: member.name,
        type: member.type,
        isOptional: member.isOptional,
        isReadonly: member.isReadonly,
      });
      continue;
    }

    if (member.kind === "methodSignature") {
      const existing = result.get(member.name);
      const signatures = existing?.methodSignatures
        ? [...existing.methodSignatures, member]
        : [member];

      result.set(member.name, {
        kind: "method",
        name: member.name,
        type: undefined,
        isOptional: false,
        isReadonly: false,
        methodSignatures: signatures,
      });
      continue;
    }
  }

  return result;
};

/**
 * Convert method declaration to IrMethodSignature
 */
const convertMethodToSignature = (
  method: ts.MethodDeclaration,
  convertType: ConvertTypeFn
): IrMethodSignature => ({
  kind: "methodSignature",
  name: method.name.getText(),
  parameters: method.parameters.map((p) => ({
    kind: "parameter" as const,
    pattern: {
      kind: "identifierPattern" as const,
      name: ts.isIdentifier(p.name) ? p.name.text : "param",
    },
    type: p.type ? convertType(p.type) : undefined,
    isOptional: !!p.questionToken || !!p.initializer,
    isRest: !!p.dotDotDotToken,
    passing: "value" as const,
  })),
  returnType: method.type ? convertType(method.type) : undefined,
  typeParameters: method.typeParameters?.map((tp) => ({
    kind: "typeParameter" as const,
    name: tp.name.text,
    constraint: tp.constraint ? convertType(tp.constraint) : undefined,
    default: tp.default ? convertType(tp.default) : undefined,
  })),
});

/**
 * Convert method signature to IrMethodSignature
 */
const convertMethodSignatureToIr = (
  method: ts.MethodSignature,
  convertType: ConvertTypeFn
): IrMethodSignature => ({
  kind: "methodSignature",
  name: method.name.getText(),
  parameters: method.parameters.map((p) => ({
    kind: "parameter" as const,
    pattern: {
      kind: "identifierPattern" as const,
      name: ts.isIdentifier(p.name) ? p.name.text : "param",
    },
    type: p.type ? convertType(p.type) : undefined,
    isOptional: !!p.questionToken || !!p.initializer,
    isRest: !!p.dotDotDotToken,
    passing: "value" as const,
  })),
  returnType: method.type ? convertType(method.type) : undefined,
  typeParameters: method.typeParameters?.map((tp) => ({
    kind: "typeParameter" as const,
    name: tp.name.text,
    constraint: tp.constraint ? convertType(tp.constraint) : undefined,
    default: tp.default ? convertType(tp.default) : undefined,
  })),
});

/**
 * Extract heritage clauses - PURE IR version
 */
const extractHeritage = (
  clauses: ts.NodeArray<ts.HeritageClause> | undefined,
  checker: ts.TypeChecker,
  sourceRoot: string,
  rootNamespace: string,
  convertType: ConvertTypeFn,
  canonicalize?: (name: string) => string
): readonly HeritageInfo[] => {
  if (!clauses) return [];

  const result: HeritageInfo[] = [];
  for (const clause of clauses) {
    const kind =
      clause.token === ts.SyntaxKind.ExtendsKeyword ? "extends" : "implements";
    for (const type of clause.types) {
      const resolvedName = resolveHeritageTypeName(
        type,
        checker,
        sourceRoot,
        rootNamespace
      );
      const rawTypeName = resolvedName ?? getTypeNodeName(type);
      if (rawTypeName) {
        // Canonicalize the type name if a canonicalizer is provided
        const typeName = canonicalize ? canonicalize(rawTypeName) : rawTypeName;
        result.push({
          kind,
          baseType: convertType(type),
          typeName,
        });
      }
    }
  }
  return result;
};

// ═══════════════════════════════════════════════════════════════════════════
// BUILD FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a TypeRegistry from source files.
 *
 * @param sourceFiles Source files to scan for declarations
 * @param checker TypeChecker for symbol resolution only (NOT for type inference)
 * @param sourceRoot Absolute path to source root directory
 * @param rootNamespace Root namespace for the project
 * @param convertType Optional type converter for pure IR storage
 */
export const buildTypeRegistry = (
  sourceFiles: readonly ts.SourceFile[],
  checker: ts.TypeChecker,
  sourceRoot: string,
  rootNamespace: string,
  options: BuildTypeRegistryOptions = {}
): TypeRegistry => {
  // Map from FQ name to pure IR entry
  const entries = new Map<string, TypeRegistryEntry>();
  // Map from simple name to FQ name (for reverse lookup)
  const simpleNameToFQ = new Map<string, string>();

  // Default converter returns unknownType (used during bootstrap)
  const convert: ConvertTypeFn =
    options.convertType ?? (() => ({ kind: "unknownType" }));

  // Helper function to process a declaration node
  const processDeclaration = (
    node: ts.Node,
    sf: ts.SourceFile,
    ns: string | undefined
  ): void => {
    // Check if this file is from a well-known Tsonic library
    const isFromWellKnownLib = isWellKnownLibrary(sf.fileName);

    // Canonicalize a type name to CLR FQ name if it's a well-known type
    // This is used for both the type itself and its heritage references
    const canonicalize = (simpleName: string): string => {
      // Check for canonical CLR name (works for both the current file and heritage refs)
      // Heritage refs like String$instance should be canonicalized even if
      // the current file isn't from a well-known lib (though it usually is)
      const canonicalName = getCanonicalClrFQName(simpleName, true);
      if (canonicalName) return canonicalName;
      return simpleName;
    };

    // Make FQ name - use canonical CLR FQ name for well-known types
    const makeFQName = (simpleName: string): string => {
      // First check if this is a well-known type that needs canonical CLR name
      const canonicalName = getCanonicalClrFQName(
        simpleName,
        isFromWellKnownLib
      );
      if (canonicalName) return canonicalName;

      // Otherwise use namespace-based FQ name
      return ns ? `${ns}.${simpleName}` : simpleName;
    };

    // Class declarations
    if (ts.isClassDeclaration(node) && node.name) {
      const simpleName = node.name.text;
      const fqName = makeFQName(simpleName);

      // Pure IR entry
      entries.set(fqName, {
        kind: "class",
        name: simpleName,
        fullyQualifiedName: fqName,
        isDeclarationFile: sf.isDeclarationFile,
        typeParameters: extractTypeParameters(node.typeParameters, convert),
        members: extractMembers(node.members, convert),
        heritage: extractHeritage(
          node.heritageClauses,
          checker,
          sourceRoot,
          rootNamespace,
          convert,
          canonicalize
        ),
      });

      simpleNameToFQ.set(simpleName, fqName);
    }

    // Interface declarations
    if (ts.isInterfaceDeclaration(node)) {
      const simpleName = node.name.text;
      const fqName = makeFQName(simpleName);

      // Merge with existing interface (for module augmentation)
      const existing = entries.get(fqName);

      if (existing && existing.kind === "interface") {
        // Merge members
        const mergedMembers = new Map(existing.members);
        for (const [memberName, memberInfo] of extractMembers(
          node.members,
          convert
        )) {
          mergedMembers.set(memberName, memberInfo);
        }
        entries.set(fqName, {
          ...existing,
          isDeclarationFile: existing.isDeclarationFile,
          members: mergedMembers,
          heritage: [
            ...existing.heritage,
            ...extractHeritage(
              node.heritageClauses,
              checker,
              sourceRoot,
              rootNamespace,
              convert,
              canonicalize
            ),
          ],
        });
      } else {
        entries.set(fqName, {
          kind: "interface",
          name: simpleName,
          fullyQualifiedName: fqName,
          isDeclarationFile: sf.isDeclarationFile,
          typeParameters: extractTypeParameters(node.typeParameters, convert),
          members: extractMembers(node.members, convert),
          heritage: extractHeritage(
            node.heritageClauses,
            checker,
            sourceRoot,
            rootNamespace,
            convert,
            canonicalize
          ),
        });
        simpleNameToFQ.set(simpleName, fqName);
      }
    }

    // Type alias declarations
    if (ts.isTypeAliasDeclaration(node)) {
      const simpleName = node.name.text;
      const fqName = makeFQName(simpleName);

      // Pure IR entry
      const aliasedType = convert(node.type);
      const aliasedMembers = extractMembersFromAliasedObjectType(aliasedType);

      entries.set(fqName, {
        kind: "typeAlias",
        name: simpleName,
        fullyQualifiedName: fqName,
        isDeclarationFile: sf.isDeclarationFile,
        typeParameters: extractTypeParameters(node.typeParameters, convert),
        members: aliasedMembers,
        heritage: [],
        aliasedType,
      });

      simpleNameToFQ.set(simpleName, fqName);
    }

    // Handle 'declare global { ... }' blocks
    if (
      ts.isModuleDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "global" &&
      node.body &&
      ts.isModuleBlock(node.body)
    ) {
      for (const stmt of node.body.statements) {
        processDeclaration(stmt, sf, undefined);
      }
    }
  };

  for (const sourceFile of sourceFiles) {
    const namespace = sourceFile.isDeclarationFile
      ? undefined
      : getNamespaceFromPath(sourceFile.fileName, sourceRoot, rootNamespace);

    ts.forEachChild(sourceFile, (node) => {
      processDeclaration(node, sourceFile, namespace);
    });
  }

  return {
    // Pure IR API
    resolveNominal: (fqName: string): TypeRegistryEntry | undefined => {
      return entries.get(fqName);
    },

    resolveBySimpleName: (
      simpleName: string
    ): TypeRegistryEntry | undefined => {
      const fqName = simpleNameToFQ.get(simpleName);
      return fqName ? entries.get(fqName) : undefined;
    },

    getFQName: (simpleName: string): string | undefined => {
      return simpleNameToFQ.get(simpleName);
    },

    getMemberType: (
      fqNominal: string,
      memberName: string
    ): IrType | undefined => {
      const entry = entries.get(fqNominal);
      if (!entry) return undefined;
      const member = entry.members.get(memberName);
      return member?.type;
    },

    getHeritageTypes: (fqNominal: string): readonly HeritageInfo[] => {
      const entry = entries.get(fqNominal);
      return entry?.heritage ?? [];
    },

    getAllTypeNames: (): readonly string[] => {
      return [...entries.keys()];
    },

    hasType: (fqName: string): boolean => {
      return entries.has(fqName);
    },
  };
};
