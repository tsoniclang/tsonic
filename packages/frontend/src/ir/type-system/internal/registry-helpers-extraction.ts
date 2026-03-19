/**
 * CLR name helpers, type parameter extraction, member extraction from
 * declarations/aliased object types, callable interface conversion,
 * method signature conversion, and heritage clause extraction.
 *
 * Split from registry-helpers.ts for file-size compliance (< 500 LOC).
 */

import * as ts from "typescript";
import type { IrType } from "../../types/index.js";
import { normalizeToClrName } from "./universe/alias-table.js";
import { tryResolveDeterministicPropertyName } from "../../syntax/property-names.js";
import { getNamespaceFromPath } from "../../../resolver/namespace.js";
import type {
  ConvertTypeFn,
  MemberInfo,
  HeritageInfo,
  TypeParameterEntry,
} from "./type-registry.js";
import {
  inferMemberType,
  convertMethodToSignature,
  convertMethodSignatureToIr,
} from "./registry-helpers-inference.js";

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL CLR NAME HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a source file is from a well-known Tsonic library.
 * These libraries contain runtime types that need canonical CLR FQ names.
 */
export const isWellKnownLibrary = (fileName: string): boolean => {
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
export const getCanonicalClrFQName = (
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
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract type parameters from a declaration
 */
export const extractTypeParameters = (
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
export const getTypeNodeName = (typeNode: ts.TypeNode): string | undefined => {
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
export const resolveHeritageTypeName = (
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

/**
 * Extract member information from a class or interface - PURE IR version
 */
export const extractMembers = (
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
      const name = tryResolveDeterministicPropertyName(member.name);
      if (!name) continue;
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
      const name = tryResolveDeterministicPropertyName(member.name);
      if (!name) continue;
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
      const name = tryResolveDeterministicPropertyName(member.name);
      if (!name) continue;
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
      const name = tryResolveDeterministicPropertyName(member.name);
      if (!name) continue;
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
      const name = tryResolveDeterministicPropertyName(member.name);
      if (!name) continue;
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
export const extractMembersFromAliasedObjectType = (
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

export const convertCallableInterfaceOnlyType = (
  node: ts.InterfaceDeclaration,
  convertType: ConvertTypeFn
): IrType | undefined => {
  if (node.typeParameters && node.typeParameters.length > 0) {
    return undefined;
  }
  if (node.heritageClauses && node.heritageClauses.length > 0) {
    return undefined;
  }
  if (node.members.length === 0) {
    return undefined;
  }
  if (!node.members.every((member) => ts.isCallSignatureDeclaration(member))) {
    return undefined;
  }

  const signatures: IrType[] = [];
  for (const member of node.members) {
    if (!ts.isCallSignatureDeclaration(member)) {
      return undefined;
    }
    if (member.typeParameters && member.typeParameters.length > 0) {
      return undefined;
    }
    signatures.push({
      kind: "functionType",
      parameters: member.parameters.map((param) => ({
        kind: "parameter",
        pattern: {
          kind: "identifierPattern",
          name: ts.isIdentifier(param.name) ? param.name.text : "[computed]",
        },
        type: param.type ? convertType(param.type) : undefined,
        initializer: undefined,
        isOptional: !!param.questionToken,
        isRest: !!param.dotDotDotToken,
        passing: "value",
      })),
      returnType: member.type ? convertType(member.type) : { kind: "voidType" },
    });
  }

  if (signatures.length === 0) {
    return undefined;
  }
  if (signatures.length === 1) {
    return signatures[0];
  }
  return {
    kind: "intersectionType",
    types: signatures,
  };
};

export { convertMethodToSignature, convertMethodSignatureToIr };

/**
 * Extract heritage clauses - PURE IR version
 */
export const extractHeritage = (
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
