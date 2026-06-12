import type { GoPtr } from "../go/compat.js";
import type { Node, NodeList } from "../internal/ast/spine.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type {
  Identifier,
  ImportDeclaration,
  ImportSpecifier,
  NamedImports,
  NamespaceImport,
  StringLiteral,
} from "../internal/ast/generated/data.js";
import {
  KindIdentifier,
  KindImportDeclaration,
  KindImportSpecifier,
  KindNamedImports,
  KindNamespaceImport,
  KindStringLiteral,
} from "../internal/ast/generated/kinds.js";
import {
  AsIdentifier,
  AsImportClause,
  AsImportDeclaration,
  AsImportSpecifier,
  AsNamedImports,
  AsNamespaceImport,
  AsStringLiteral,
} from "../internal/ast/generated/casts.js";
import { Node_IsTypeOnly } from "../internal/ast/ast.js";

export type ExtensionImportBindingKind = "named" | "namespace" | "default";

export type ExtensionImportBinding = {
  readonly kind: ExtensionImportBindingKind;
  readonly localName: string;
  readonly importedName: string;
  readonly isTypeOnly: boolean;
  readonly importNode: GoPtr<Node>;
  readonly bindingNode: GoPtr<Node>;
};

export type ExtensionImportModule = {
  readonly specifier: string;
  readonly importNode: GoPtr<Node>;
  readonly bindings: readonly ExtensionImportBinding[];
};

export type ExtensionImportIndex = {
  readonly sourceFile: GoPtr<SourceFile>;
  readonly modules: readonly ExtensionImportModule[];
  getBindingsFrom(specifier: string): readonly ExtensionImportBinding[];
  resolveLocalName(localName: string): ExtensionImportBinding | undefined;
};

const nodeText = (node: GoPtr<Node>): string | undefined => {
  if (!node) return undefined;
  if (node.Kind === KindIdentifier) {
    return AsIdentifier(node)?.Text;
  }
  if (node.Kind === KindStringLiteral) {
    return AsStringLiteral(node)?.Text;
  }
  return undefined;
};

const nodesOf = (list: GoPtr<NodeList>): readonly GoPtr<Node>[] =>
  list?.Nodes ?? [];

const collectNamedBindings = (
  namedImports: GoPtr<NamedImports>,
  importNode: GoPtr<Node>,
  isImportClauseTypeOnly: boolean,
): readonly ExtensionImportBinding[] => {
  const bindings: ExtensionImportBinding[] = [];
  for (const specifierNode of nodesOf(namedImports?.Elements)) {
    if (specifierNode?.Kind !== KindImportSpecifier) continue;
    const specifier = AsImportSpecifier(specifierNode);
    if (!specifier) continue;
    const localName = nodeText(specifier.name);
    const importedName = nodeText(specifier.PropertyName) ?? localName;
    if (!localName || !importedName) continue;
    bindings.push({
      kind: "named",
      localName,
      importedName,
      isTypeOnly: isImportClauseTypeOnly || specifier.IsTypeOnly === true,
      importNode,
      bindingNode: specifierNode,
    });
  }
  return bindings;
};

const collectImportBindings = (
  declaration: GoPtr<ImportDeclaration>,
  importNode: GoPtr<Node>,
): readonly ExtensionImportBinding[] => {
  const clauseNode = declaration?.ImportClause;
  if (!clauseNode) return [];
  const clause = AsImportClause(clauseNode);
  if (!clause) return [];

  const bindings: ExtensionImportBinding[] = [];
  const isImportClauseTypeOnly = isTypeOnlyImportClause(clauseNode);
  const defaultName = nodeText(clause.name);
  if (defaultName) {
    bindings.push({
      kind: "default",
      localName: defaultName,
      importedName: "default",
      isTypeOnly: isImportClauseTypeOnly,
      importNode,
      bindingNode: clause.name,
    });
  }

  const namedBindings = clause.NamedBindings;
  if (namedBindings?.Kind === KindNamedImports) {
    bindings.push(
      ...collectNamedBindings(
        AsNamedImports(namedBindings),
        importNode,
        isImportClauseTypeOnly,
      ),
    );
  }

  if (namedBindings?.Kind === KindNamespaceImport) {
    const namespaceImport = AsNamespaceImport(namedBindings) as GoPtr<NamespaceImport>;
    const namespaceName = nodeText(namespaceImport?.name);
    if (namespaceName) {
      bindings.push({
        kind: "namespace",
        localName: namespaceName,
        importedName: "*",
        isTypeOnly: isImportClauseTypeOnly,
        importNode,
        bindingNode: namedBindings,
      });
    }
  }

  return bindings;
};

const isTypeOnlyImportClause = (clause: GoPtr<Node>): boolean =>
  Node_IsTypeOnly(clause);

export const createExtensionImportIndex = (
  sourceFile: GoPtr<SourceFile>,
): ExtensionImportIndex => {
  const modules: ExtensionImportModule[] = [];
  const bindingsByLocalName = new Map<string, ExtensionImportBinding>();

  for (const statement of nodesOf(sourceFile?.Statements)) {
    if (statement?.Kind !== KindImportDeclaration) continue;
    const declaration = AsImportDeclaration(statement);
    if (!declaration) continue;
    const moduleSpecifier = AsStringLiteral(declaration.ModuleSpecifier);
    const specifier = moduleSpecifier?.Text;
    if (!specifier) continue;

    const bindings = collectImportBindings(declaration, statement);
    for (const binding of bindings) {
      bindingsByLocalName.set(binding.localName, binding);
    }
    modules.push({
      specifier,
      importNode: statement,
      bindings,
    });
  }

  return {
    sourceFile,
    modules,
    getBindingsFrom: (specifier: string): readonly ExtensionImportBinding[] =>
      modules
        .filter((module) => module.specifier === specifier)
        .flatMap((module) => module.bindings),
    resolveLocalName: (
      localName: string,
    ): ExtensionImportBinding | undefined => bindingsByLocalName.get(localName),
  };
};
