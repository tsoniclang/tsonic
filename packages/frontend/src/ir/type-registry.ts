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
  readonly name: string;
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
   * Resolve a type by name. Returns undefined if not found.
   */
  readonly resolveNominal: (name: string) => TypeRegistryEntry | undefined;

  /**
   * Get a member's TypeNode from a nominal type.
   * Returns undefined if member not found.
   */
  readonly getMemberTypeNode: (
    nominal: string,
    memberName: string
  ) => ts.TypeNode | undefined;

  /**
   * Get all heritage clauses for a nominal type.
   */
  readonly getHeritageTypeNodes: (nominal: string) => readonly HeritageInfo[];

  /**
   * Get all registered type names.
   */
  readonly getAllTypeNames: () => readonly string[];

  /**
   * Check if a type name is registered.
   */
  readonly hasType: (name: string) => boolean;
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
 */
export const buildTypeRegistry = (
  sourceFiles: readonly ts.SourceFile[],
  _checker: ts.TypeChecker // Only for symbol resolution, not used yet
): TypeRegistry => {
  const entries = new Map<string, TypeRegistryEntry>();

  for (const sourceFile of sourceFiles) {
    // Walk the source file for declarations
    ts.forEachChild(sourceFile, (node) => {
      // Class declarations
      if (ts.isClassDeclaration(node) && node.name) {
        const name = node.name.text;
        entries.set(name, {
          kind: "class",
          name,
          typeParameters: extractTypeParameters(node.typeParameters),
          declaration: node,
          members: extractMembers(node.members),
          heritage: extractHeritage(node.heritageClauses),
          sourceFile,
        });
      }

      // Interface declarations
      if (ts.isInterfaceDeclaration(node)) {
        const name = node.name.text;
        // Merge with existing interface (for module augmentation)
        const existing = entries.get(name);
        if (existing && existing.kind === "interface") {
          // Merge members
          const mergedMembers = new Map(existing.members);
          for (const [memberName, memberInfo] of extractMembers(node.members)) {
            mergedMembers.set(memberName, memberInfo);
          }
          entries.set(name, {
            ...existing,
            members: mergedMembers,
            heritage: [
              ...existing.heritage,
              ...extractHeritage(node.heritageClauses),
            ],
          });
        } else {
          entries.set(name, {
            kind: "interface",
            name,
            typeParameters: extractTypeParameters(node.typeParameters),
            declaration: node,
            members: extractMembers(node.members),
            heritage: extractHeritage(node.heritageClauses),
            sourceFile,
          });
        }
      }

      // Type alias declarations
      if (ts.isTypeAliasDeclaration(node)) {
        const name = node.name.text;
        entries.set(name, {
          kind: "typeAlias",
          name,
          typeParameters: extractTypeParameters(node.typeParameters),
          declaration: node,
          members: new Map(), // Type aliases don't have members directly
          heritage: [], // Type aliases don't have heritage clauses
          sourceFile,
        });
      }
    });
  }

  return {
    resolveNominal: (name: string): TypeRegistryEntry | undefined => {
      return entries.get(name);
    },

    getMemberTypeNode: (
      nominal: string,
      memberName: string
    ): ts.TypeNode | undefined => {
      const entry = entries.get(nominal);
      if (!entry) return undefined;

      // Direct lookup
      const member = entry.members.get(memberName);
      if (member?.typeNode) return member.typeNode;

      // TODO: Check heritage chain if not found directly
      // This will be handled by NominalEnv in Step 2
      return undefined;
    },

    getHeritageTypeNodes: (nominal: string): readonly HeritageInfo[] => {
      const entry = entries.get(nominal);
      return entry?.heritage ?? [];
    },

    getAllTypeNames: (): readonly string[] => {
      return [...entries.keys()];
    },

    hasType: (name: string): boolean => {
      return entries.has(name);
    },
  };
};
