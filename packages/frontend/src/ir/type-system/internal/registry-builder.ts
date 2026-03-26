/**
 * TypeRegistry builder — constructs a TypeRegistry from source files.
 *
 * Split from type-registry.ts for file-size hygiene.
 * The buildTypeRegistry function is copied EXACTLY from the original.
 */

import * as ts from "typescript";
import type {
  TypeRegistry,
  TypeRegistryEntry,
  HeritageInfo,
  ConvertTypeFn,
  BuildTypeRegistryOptions,
} from "./type-registry.js";
import {
  isWellKnownLibrary,
  getCanonicalClrFQName,
  extractTypeParameters,
  extractMembers,
  extractMembersFromAliasedObjectType,
  convertCallableInterfaceOnlyType,
  extractHeritage,
} from "./registry-helpers.js";
import type { IrType } from "../../types/index.js";
import {
  resolveSourceFileNamespace,
  resolveSourceFileOwnerIdentity,
} from "../../../program/source-file-identity.js";

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
    ns: string | undefined,
    ownerIdentity: string
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
        ownerIdentity,
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
      const callableAlias = convertCallableInterfaceOnlyType(node, convert);

      if (callableAlias) {
        const aliasedMembers =
          extractMembersFromAliasedObjectType(callableAlias);
        entries.set(fqName, {
          kind: "typeAlias",
          name: simpleName,
          fullyQualifiedName: fqName,
          ownerIdentity,
          isDeclarationFile: sf.isDeclarationFile,
          typeParameters: [],
          members: aliasedMembers,
          heritage: [],
          aliasedType: callableAlias,
        });
        simpleNameToFQ.set(simpleName, fqName);
      } else {
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
            ownerIdentity,
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
        ownerIdentity,
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
        processDeclaration(stmt, sf, undefined, ownerIdentity);
      }
    }
  };

  for (const sourceFile of sourceFiles) {
    const ownerIdentity = resolveSourceFileOwnerIdentity(
      sourceFile.fileName,
      sourceRoot,
      rootNamespace
    );
    const namespace = sourceFile.isDeclarationFile
      ? undefined
      : resolveSourceFileNamespace(
          sourceFile.fileName,
          sourceRoot,
          rootNamespace
        );

    ts.forEachChild(sourceFile, (node) => {
      processDeclaration(node, sourceFile, namespace, ownerIdentity);
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
