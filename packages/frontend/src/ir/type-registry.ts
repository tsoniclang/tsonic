/**
 * TypeRegistry - AST-based source of truth for type declarations
 *
 * This registry stores TypeNodes and declaration nodes, NOT ts.Type.
 * It enables deterministic type resolution without using TypeScript's
 * computed type inference APIs (getTypeAtLocation, etc.).
 *
 * Part of Alice's specification for deterministic IR typing.
 */

import * as ts from "typescript";
import { getNamespaceFromPath } from "../resolver/namespace.js";

/**
 * Information about a type member (property or method)
 */
export type MemberInfo = {
  readonly kind: "property" | "method" | "indexSignature";
  readonly name: string;
  readonly typeNode: ts.TypeNode | undefined; // Preserve source TypeNode
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
  readonly signatures?: readonly ts.SignatureDeclaration[]; // For methods
  readonly declaration: ts.Node; // Original declaration node
};

/**
 * Heritage clause information (extends/implements)
 */
export type HeritageInfo = {
  readonly kind: "extends" | "implements";
  readonly typeNode: ts.TypeNode; // The full type reference with args
  readonly typeName: string; // The resolved type name
};

/**
 * Entry for a nominal type (class, interface, type alias)
 */
export type TypeRegistryEntry = {
  readonly kind: "class" | "interface" | "typeAlias";
  readonly name: string; // Simple name (e.g., "User")
  readonly fullyQualifiedName: string; // FQ name (e.g., "MyApp.Models.User")
  readonly typeParameters: readonly string[];
  readonly declaration:
    | ts.ClassDeclaration
    | ts.InterfaceDeclaration
    | ts.TypeAliasDeclaration;
  readonly members: ReadonlyMap<string, MemberInfo>;
  readonly heritage: readonly HeritageInfo[];
  readonly sourceFile: ts.SourceFile;
};

/**
 * TypeRegistry API
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
   * Get a member's TypeNode from a nominal type (by FQ name).
   * Returns undefined if member not found.
   */
  readonly getMemberTypeNode: (
    fqNominal: string,
    memberName: string
  ) => ts.TypeNode | undefined;

  /**
   * Get all heritage clauses for a nominal type (by FQ name).
   */
  readonly getHeritageTypeNodes: (fqNominal: string) => readonly HeritageInfo[];

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
 * Extract type parameters from a declaration
 */
const extractTypeParameters = (
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
      // Handle Namespace.Type
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
 * Extract member information from a class or interface
 */
const extractMembers = (
  members: ts.NodeArray<ts.ClassElement> | ts.NodeArray<ts.TypeElement>
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
        typeNode: member.type,
        isOptional,
        isReadonly: isReadonly ?? false,
        declaration: member,
      });
    }

    // Property signatures (interface)
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

    // Method declarations (class)
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

    // Method signatures (interface)
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

    // Index signatures (interface)
    if (ts.isIndexSignatureDeclaration(member)) {
      // Use a synthetic name for index signatures
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
 * Extract heritage clauses from a class or interface
 */
const extractHeritage = (
  clauses: ts.NodeArray<ts.HeritageClause> | undefined
): readonly HeritageInfo[] => {
  if (!clauses) return [];

  const result: HeritageInfo[] = [];
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

/**
 * Build a TypeRegistry from source files.
 *
 * @param sourceFiles Source files to scan for declarations
 * @param checker TypeChecker for symbol resolution only (NOT for type inference)
 * @param sourceRoot Absolute path to source root directory
 * @param rootNamespace Root namespace for the project
 */
export const buildTypeRegistry = (
  sourceFiles: readonly ts.SourceFile[],
  _checker: ts.TypeChecker, // Only for symbol resolution, not used yet
  sourceRoot: string,
  rootNamespace: string
): TypeRegistry => {
  // Map from FQ name to entry
  const entries = new Map<string, TypeRegistryEntry>();
  // Map from simple name to FQ name (for reverse lookup)
  const simpleNameToFQ = new Map<string, string>();

  // Helper function to process a declaration node
  const processDeclaration = (
    node: ts.Node,
    sf: ts.SourceFile,
    ns: string | undefined
  ): void => {
    const makeFQName = (simpleName: string): string =>
      ns ? `${ns}.${simpleName}` : simpleName;

    // Class declarations
    if (ts.isClassDeclaration(node) && node.name) {
      const simpleName = node.name.text;
      const fqName = makeFQName(simpleName);
      entries.set(fqName, {
        kind: "class",
        name: simpleName,
        fullyQualifiedName: fqName,
        typeParameters: extractTypeParameters(node.typeParameters),
        declaration: node,
        members: extractMembers(node.members),
        heritage: extractHeritage(node.heritageClauses),
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
      if (existing && existing.kind === "interface") {
        // Merge members
        const mergedMembers = new Map(existing.members);
        for (const [memberName, memberInfo] of extractMembers(node.members)) {
          mergedMembers.set(memberName, memberInfo);
        }
        entries.set(fqName, {
          ...existing,
          members: mergedMembers,
          heritage: [
            ...existing.heritage,
            ...extractHeritage(node.heritageClauses),
          ],
        });
      } else {
        entries.set(fqName, {
          kind: "interface",
          name: simpleName,
          fullyQualifiedName: fqName,
          typeParameters: extractTypeParameters(node.typeParameters),
          declaration: node,
          members: extractMembers(node.members),
          heritage: extractHeritage(node.heritageClauses),
          sourceFile: sf,
        });
        simpleNameToFQ.set(simpleName, fqName);
      }
    }

    // Type alias declarations
    if (ts.isTypeAliasDeclaration(node)) {
      const simpleName = node.name.text;
      const fqName = makeFQName(simpleName);
      entries.set(fqName, {
        kind: "typeAlias",
        name: simpleName,
        fullyQualifiedName: fqName,
        typeParameters: extractTypeParameters(node.typeParameters),
        declaration: node,
        members: new Map(), // Type aliases don't have members directly
        heritage: [], // Type aliases don't have heritage clauses
        sourceFile: sf,
      });
      simpleNameToFQ.set(simpleName, fqName);
    }

    // Handle 'declare global { ... }' blocks
    // These are ModuleDeclarations with name "global" - declarations inside are at global scope
    if (
      ts.isModuleDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "global" &&
      node.body &&
      ts.isModuleBlock(node.body)
    ) {
      // Recursively process declarations inside the global block
      // All declarations inside 'declare global' are at global scope (no namespace)
      for (const stmt of node.body.statements) {
        processDeclaration(stmt, sf, undefined);
      }
    }
  };

  for (const sourceFile of sourceFiles) {
    // Compute namespace for this file
    // For declaration files (globals, dotnet types), use undefined to signal global scope
    // so types are registered with simple name (e.g., "String" not "SomeRandomPath.String")
    const namespace = sourceFile.isDeclarationFile
      ? undefined // Global scope for .d.ts files
      : getNamespaceFromPath(sourceFile.fileName, sourceRoot, rootNamespace);

    // Walk the source file for declarations
    ts.forEachChild(sourceFile, (node) => {
      processDeclaration(node, sourceFile, namespace);
    });
  }

  return {
    // Resolve by FQ name (preferred)
    resolveNominal: (fqName: string): TypeRegistryEntry | undefined => {
      return entries.get(fqName);
    },

    // Resolve by simple name (for backwards compatibility, returns first match)
    resolveBySimpleName: (
      simpleName: string
    ): TypeRegistryEntry | undefined => {
      const fqName = simpleNameToFQ.get(simpleName);
      return fqName ? entries.get(fqName) : undefined;
    },

    // Get FQ name from simple name
    getFQName: (simpleName: string): string | undefined => {
      return simpleNameToFQ.get(simpleName);
    },

    getMemberTypeNode: (
      fqNominal: string,
      memberName: string
    ): ts.TypeNode | undefined => {
      const entry = entries.get(fqNominal);
      if (!entry) return undefined;

      // Direct lookup
      const member = entry.members.get(memberName);
      if (member?.typeNode) return member.typeNode;

      // TODO: Check heritage chain if not found directly
      // This will be handled by NominalEnv in Step 2
      return undefined;
    },

    getHeritageTypeNodes: (fqNominal: string): readonly HeritageInfo[] => {
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
