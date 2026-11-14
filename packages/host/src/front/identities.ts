import type { DefinitionSegment, ModuleId, NodeId } from "../ids/contract.js";
import type { ModuleDefinitionRow, ModuleDefinitions } from "./contract.js";
import { encodeDefId } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import { childrenOfSyntax, isModuleBindingKind } from "../ir-hir/index.js";

function nameText(name: Hir.SyntaxNode<Hir.SyntaxPhase>): string | null {
  switch (name.kind) {
    case "Identifier": case "PrivateIdentifier": case "StringLiteral": case "NumericLiteral": return name.text;
    case "ComputedPropertyName":
      throw new TypeError("front: the definition name of a computed member name is not implemented");
    default: return null;
  }
}

/**
 * The segment name a node takes by F-1's name sources with Codex's rulings (K-3236, K-3250, K-3268): the authored
 * name; the export name `default` for an anonymous default function or class declaration; `export=` or `default`
 * for an export assignment; the empty name for an unnamed member, an expression, and a parameter that holds a
 * pattern. Null when the node has no identity (a variable declaration or binding element that holds a pattern, and
 * every kind that is not a declaration).
 */
export function identityName(node: Hir.SyntaxNode<Hir.SyntaxPhase>): string | null {
  switch (node.kind) {
    case "SourceFile":
    case "FunctionExpression": case "ArrowFunction": case "ClassExpression":
    case "Constructor": case "ClassStaticBlockDeclaration": case "CallSignature": case "ConstructSignature": case "IndexSignature":
      return "";
    case "ExportAssignment": return node.isExportEquals ? "export=" : "default";
    case "Parameter": return node.name.kind === "Identifier" ? node.name.text : "";
    case "VariableDeclaration": case "BindingElement": {
      const name = node.name;
      return name !== null && name.kind === "Identifier" ? name.text : null;
    }
    case "FunctionDeclaration": case "ClassDeclaration": return node.name === null ? "default" : nameText(node.name);
    case "InterfaceDeclaration": case "TypeAliasDeclaration": case "EnumDeclaration": case "EnumMember": case "ModuleDeclaration":
    case "TypeParameter": case "PropertyDeclaration": case "MethodDeclaration": case "GetAccessor": case "SetAccessor":
    case "PropertySignature": case "MethodSignature": case "NamespaceExport":
      return nameText(node.name);
    default: return null;
  }
}

interface Owner {
  readonly node: NodeId;
  readonly segments: readonly DefinitionSegment[];
}

/**
 * The definition identities of one module, in the syntax tree's preorder: each declaration's owner is the nearest
 * enclosing declaration that has an identity, and its ordinal counts the declarations of that name in that owner
 * before it, whatever their kind. The counters belong to the owner itself (its node), never to a spelling of its
 * path, so names holding `#`, `/` or `:` cannot make two owners share a counter (K-3343).
 */
export function moduleIdentities(module: ModuleId, tree: Hir.SourceFile<Hir.SyntaxPhase>): ModuleDefinitions {
  const rows: ModuleDefinitionRow[] = [];
  const bindingSources: ModuleDefinitions["bindingSources"][number][] = [];
  const counts = new Map<NodeId, Map<string, number>>();
  const pending: { readonly node: Hir.SyntaxNode<Hir.SyntaxPhase>; readonly owner: Owner | null }[] = [{ node: tree, owner: null }];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const { node, owner } = next;
    const name = identityName(node);
    let inner = owner;
    if (name !== null) {
      let segments: readonly DefinitionSegment[] = [];
      if (owner !== null) {
        const names = counts.get(owner.node) ?? new Map<string, number>();
        const ordinal = names.get(name) ?? 0;
        names.set(name, ordinal + 1);
        counts.set(owner.node, names);
        segments = [...owner.segments, { name, ordinal }];
      }
      rows.push({ node: node.id, kind: node.kind, segments, definition: encodeDefId({ module, segments }) });
      inner = { node: node.id, segments };
    }
    if (isModuleBindingKind(node.kind, node.kind !== "ImportClause" || node.name !== null)) {
      if (inner === null) throw new TypeError("front: a binding has no genuine enclosing declaration identity");
      bindingSources.push({ node: node.id, occurrence: { kind: "item", value: {
        owner: encodeDefId({ module, segments: inner.segments }), node: node.id } } });
    }
    const children = childrenOfSyntax(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) pending.push({ node: child, owner: inner });
    }
  }
  return { module, rows, bindingSources };
}
