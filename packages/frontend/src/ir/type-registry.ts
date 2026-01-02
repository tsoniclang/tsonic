/**
 * TypeRegistry - Pure IR source of truth for type declarations
 *
 * ALICE'S SPEC (Step 3): This registry stores IrType (pure IR), NOT ts.TypeNode.
 * Types are converted at registration time, making queries deterministic.
 *
 * CANONICAL CLR IDENTITY: Well-known runtime types from @tsonic/globals,
 * @tsonic/core, and @tsonic/dotnet are registered with canonical CLR FQ names
 * (e.g., String → System.String, String$instance → System.String$instance).
 *
 * Part of Alice's specification for deterministic IR typing.
 */

import * as ts from "typescript";
import type { IrType, IrMethodSignature } from "./types/index.js";
import { getNamespaceFromPath } from "../resolver/namespace.js";
import { GLOBALS_TO_CLR_FQ } from "./clr-type-mappings.js";

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL CLR NAME HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a source file is from a well-known Tsonic library.
 * These libraries contain runtime types that need canonical CLR FQ names.
 */
const isWellKnownLibrary = (fileName: string): boolean => {
  return (
    fileName.includes("@tsonic/globals") ||
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
  const directMapping = GLOBALS_TO_CLR_FQ[simpleName];
  if (directMapping) return directMapping;

  // Handle $instance companions - they map to System.X$instance
  if (simpleName.endsWith("$instance")) {
    const baseName = simpleName.slice(0, -9); // Remove "$instance"
    const baseClrName = GLOBALS_TO_CLR_FQ[baseName];
    if (baseClrName) {
      return `${baseClrName}$instance`;
    }
  }

  // Handle __X$views companions - they map to System.X$views
  if (simpleName.includes("$views")) {
    const baseName = simpleName.replace("__", "").replace("$views", "");
    const baseClrName = GLOBALS_TO_CLR_FQ[baseName];
    if (baseClrName) {
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
  readonly typeParameters: readonly TypeParameterEntry[]; // PURE IR
  readonly members: ReadonlyMap<string, MemberInfo>; // PURE IR
  readonly heritage: readonly HeritageInfo[]; // PURE IR
  readonly aliasedType?: IrType; // For type aliases - the aliased type (PURE IR)
};

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY TYPES (for backwards compatibility during migration)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Legacy member info with TypeNode (for backwards compatibility)
 * @deprecated Use MemberInfo instead. This will be removed after Step 7.
 */
export type LegacyMemberInfo = {
  readonly kind: "property" | "method" | "indexSignature";
  readonly name: string;
  readonly typeNode: ts.TypeNode | undefined;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
  readonly signatures?: readonly ts.SignatureDeclaration[];
  readonly declaration: ts.Node;
};

/**
 * Legacy heritage info with TypeNode (for backwards compatibility)
 * @deprecated Use HeritageInfo instead. This will be removed after Step 7.
 */
export type LegacyHeritageInfo = {
  readonly kind: "extends" | "implements";
  readonly typeNode: ts.TypeNode;
  readonly typeName: string;
};

/**
 * Legacy entry with TypeNode fields (for backwards compatibility)
 * @deprecated Use TypeRegistryEntry instead. This will be removed after Step 7.
 */
export type LegacyTypeRegistryEntry = {
  readonly kind: "class" | "interface" | "typeAlias";
  readonly name: string;
  readonly fullyQualifiedName: string;
  readonly typeParameters: readonly string[];
  readonly declaration:
    | ts.ClassDeclaration
    | ts.InterfaceDeclaration
    | ts.TypeAliasDeclaration;
  readonly members: ReadonlyMap<string, LegacyMemberInfo>;
  readonly heritage: readonly LegacyHeritageInfo[];
  readonly sourceFile: ts.SourceFile;
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
   * Resolve a type by simple name (for backwards compatibility).
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

  // ─────────────────────────────────────────────────────────────────────────
  // LEGACY API (for backwards compatibility during migration)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @deprecated Use getMemberType instead. This will be removed after Step 7.
   */
  readonly getMemberTypeNode: (
    fqNominal: string,
    memberName: string
  ) => ts.TypeNode | undefined;

  /**
   * @deprecated Use getHeritageTypes instead. This will be removed after Step 7.
   */
  readonly getHeritageTypeNodes: (
    fqNominal: string
  ) => readonly LegacyHeritageInfo[];

  /**
   * @deprecated Access to legacy entry for backwards compatibility.
   */
  readonly getLegacyEntry: (
    fqName: string
  ) => LegacyTypeRegistryEntry | undefined;
};

/**
 * Type conversion function - converts TypeNode to IrType
 */
export type ConvertTypeFn = (typeNode: ts.TypeNode) => IrType;

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
 * Extract type parameter names (legacy)
 */
const extractTypeParameterNames = (
  typeParams: ts.NodeArray<ts.TypeParameterDeclaration> | undefined
): readonly string[] => {
  if (!typeParams) return [];
  return typeParams.map((p) => p.name.text);
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
 * Extract member information from a class or interface - PURE IR version
 */
const extractMembers = (
  members: ts.NodeArray<ts.ClassElement> | ts.NodeArray<ts.TypeElement>,
  convertType: ConvertTypeFn
): ReadonlyMap<string, MemberInfo> => {
  const result = new Map<string, MemberInfo>();

  for (const member of members) {
    // Property declarations (class)
    if (ts.isPropertyDeclaration(member)) {
      const name = member.name.getText();
      const isOptional =
        member.questionToken !== undefined || member.initializer !== undefined;
      const isReadonly = member.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
      );
      result.set(name, {
        kind: "property",
        name,
        type: member.type ? convertType(member.type) : undefined,
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
 * Extract legacy member information (with TypeNodes)
 */
const extractLegacyMembers = (
  members: ts.NodeArray<ts.ClassElement> | ts.NodeArray<ts.TypeElement>
): ReadonlyMap<string, LegacyMemberInfo> => {
  const result = new Map<string, LegacyMemberInfo>();

  for (const member of members) {
    if (ts.isPropertyDeclaration(member)) {
      const name = member.name.getText();
      const isOptional =
        member.questionToken !== undefined || member.initializer !== undefined;
      const isReadonly = member.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
      );
      result.set(name, {
        kind: "property",
        name,
        typeNode: member.type,
        isOptional,
        isReadonly: isReadonly ?? false,
        declaration: member,
      });
    }

    if (ts.isPropertySignature(member)) {
      const name = member.name.getText();
      result.set(name, {
        kind: "property",
        name,
        typeNode: member.type,
        isOptional: member.questionToken !== undefined,
        isReadonly:
          member.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
          ) ?? false,
        declaration: member,
      });
    }

    if (ts.isMethodDeclaration(member)) {
      const name = member.name.getText();
      const existing = result.get(name);
      const signatures = existing?.signatures
        ? [...existing.signatures, member]
        : [member];
      result.set(name, {
        kind: "method",
        name,
        typeNode: member.type,
        isOptional: member.questionToken !== undefined,
        isReadonly: false,
        signatures,
        declaration: member,
      });
    }

    if (ts.isMethodSignature(member)) {
      const name = member.name.getText();
      const existing = result.get(name);
      const signatures = existing?.signatures
        ? [...existing.signatures, member]
        : [member];
      result.set(name, {
        kind: "method",
        name,
        typeNode: member.type,
        isOptional: member.questionToken !== undefined,
        isReadonly: false,
        signatures,
        declaration: member,
      });
    }

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
        typeNode: member.type,
        isOptional: false,
        isReadonly:
          member.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
          ) ?? false,
        declaration: member,
      });
    }
  }

  return result;
};

/**
 * Extract heritage clauses - PURE IR version
 */
const extractHeritage = (
  clauses: ts.NodeArray<ts.HeritageClause> | undefined,
  convertType: ConvertTypeFn,
  canonicalize?: (name: string) => string
): readonly HeritageInfo[] => {
  if (!clauses) return [];

  const result: HeritageInfo[] = [];
  for (const clause of clauses) {
    const kind =
      clause.token === ts.SyntaxKind.ExtendsKeyword ? "extends" : "implements";
    for (const type of clause.types) {
      const rawTypeName = getTypeNodeName(type);
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

/**
 * Extract legacy heritage clauses (with TypeNodes)
 */
const extractLegacyHeritage = (
  clauses: ts.NodeArray<ts.HeritageClause> | undefined
): readonly LegacyHeritageInfo[] => {
  if (!clauses) return [];

  const result: LegacyHeritageInfo[] = [];
  for (const clause of clauses) {
    const kind =
      clause.token === ts.SyntaxKind.ExtendsKeyword ? "extends" : "implements";
    for (const type of clause.types) {
      const typeName = getTypeNodeName(type);
      if (typeName) {
        result.push({
          kind,
          typeNode: type,
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
  _checker: ts.TypeChecker,
  sourceRoot: string,
  rootNamespace: string,
  convertType?: ConvertTypeFn
): TypeRegistry => {
  // Map from FQ name to pure IR entry
  const entries = new Map<string, TypeRegistryEntry>();
  // Map from FQ name to legacy entry (for backwards compatibility)
  const legacyEntries = new Map<string, LegacyTypeRegistryEntry>();
  // Map from simple name to FQ name (for reverse lookup)
  const simpleNameToFQ = new Map<string, string>();

  // Default converter returns unknownType (used during bootstrap)
  const convert: ConvertTypeFn =
    convertType ?? (() => ({ kind: "unknownType" }));

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
        typeParameters: extractTypeParameters(node.typeParameters, convert),
        members: extractMembers(node.members, convert),
        heritage: extractHeritage(node.heritageClauses, convert, canonicalize),
      });

      // Legacy entry
      legacyEntries.set(fqName, {
        kind: "class",
        name: simpleName,
        fullyQualifiedName: fqName,
        typeParameters: extractTypeParameterNames(node.typeParameters),
        declaration: node,
        members: extractLegacyMembers(node.members),
        heritage: extractLegacyHeritage(node.heritageClauses),
        sourceFile: sf,
      });

      simpleNameToFQ.set(simpleName, fqName);
    }

    // Interface declarations
    if (ts.isInterfaceDeclaration(node)) {
      const simpleName = node.name.text;
      const fqName = makeFQName(simpleName);

      // Merge with existing interface (for module augmentation)
      const existing = entries.get(fqName);
      const legacyExisting = legacyEntries.get(fqName);

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
          members: mergedMembers,
          heritage: [
            ...existing.heritage,
            ...extractHeritage(node.heritageClauses, convert, canonicalize),
          ],
        });
      } else {
        entries.set(fqName, {
          kind: "interface",
          name: simpleName,
          fullyQualifiedName: fqName,
          typeParameters: extractTypeParameters(node.typeParameters, convert),
          members: extractMembers(node.members, convert),
          heritage: extractHeritage(
            node.heritageClauses,
            convert,
            canonicalize
          ),
        });
        simpleNameToFQ.set(simpleName, fqName);
      }

      // Legacy entry merge
      if (legacyExisting && legacyExisting.kind === "interface") {
        const mergedLegacyMembers = new Map(legacyExisting.members);
        for (const [memberName, memberInfo] of extractLegacyMembers(
          node.members
        )) {
          mergedLegacyMembers.set(memberName, memberInfo);
        }
        legacyEntries.set(fqName, {
          ...legacyExisting,
          members: mergedLegacyMembers,
          heritage: [
            ...legacyExisting.heritage,
            ...extractLegacyHeritage(node.heritageClauses),
          ],
        });
      } else {
        legacyEntries.set(fqName, {
          kind: "interface",
          name: simpleName,
          fullyQualifiedName: fqName,
          typeParameters: extractTypeParameterNames(node.typeParameters),
          declaration: node,
          members: extractLegacyMembers(node.members),
          heritage: extractLegacyHeritage(node.heritageClauses),
          sourceFile: sf,
        });
      }
    }

    // Type alias declarations
    if (ts.isTypeAliasDeclaration(node)) {
      const simpleName = node.name.text;
      const fqName = makeFQName(simpleName);

      // Pure IR entry
      entries.set(fqName, {
        kind: "typeAlias",
        name: simpleName,
        fullyQualifiedName: fqName,
        typeParameters: extractTypeParameters(node.typeParameters, convert),
        members: new Map(),
        heritage: [],
        aliasedType: convert(node.type),
      });

      // Legacy entry
      legacyEntries.set(fqName, {
        kind: "typeAlias",
        name: simpleName,
        fullyQualifiedName: fqName,
        typeParameters: extractTypeParameterNames(node.typeParameters),
        declaration: node,
        members: new Map(),
        heritage: [],
        sourceFile: sf,
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

    // Legacy API (for backwards compatibility)
    getMemberTypeNode: (
      fqNominal: string,
      memberName: string
    ): ts.TypeNode | undefined => {
      const entry = legacyEntries.get(fqNominal);
      if (!entry) return undefined;
      const member = entry.members.get(memberName);
      return member?.typeNode;
    },

    getHeritageTypeNodes: (
      fqNominal: string
    ): readonly LegacyHeritageInfo[] => {
      const entry = legacyEntries.get(fqNominal);
      return entry?.heritage ?? [];
    },

    getLegacyEntry: (fqName: string): LegacyTypeRegistryEntry | undefined => {
      return legacyEntries.get(fqName);
    },
  };
};
