import type { DefId, DefinitionSegment, ModuleId, NodeId } from "../ids/contract.js";
import type { ModuleDefinitionRow, ModuleDefinitions, RawNodeRef, RawPropertyName } from "./contract.js";
import { encodeBodyId, encodeDefId } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import { childrenOfSyntax, isModuleBindingKind } from "../ir-hir/index.js";
import { childSourceBody, enterSourceBody } from "./source-bodies.js";
import type { SourceBodyScope } from "./source-bodies.js";

function nameText(name: Hir.SyntaxNode<Hir.SyntaxPhase>, module: ModuleId,
  properties: ReadonlyMap<NodeId, RawPropertyName>, definitions: ReadonlyMap<NodeId, DefId>): string | null {
  switch (name.kind) {
    case "Identifier": case "PrivateIdentifier": case "StringLiteral": case "NumericLiteral": return name.text;
    case "ComputedPropertyName": {
      const property = properties.get(name.id);
      if (property === undefined) throw new TypeError("front: a computed declaration requires its actual captured property-key state");
      const selected = property.selected;
      if (selected.kind === "unavailable" || selected.value === null) return "";
      const key = selected.value;
      if (key.kind === "text") return key.value;
      if (key.kind === "numeric") {
        if (key.value.kind !== "checker-value") throw new TypeError("front: authored numeric computed-key identity requires its exact numeric capture");
        return String(key.value.value);
      }
      const definition = key.declaration.module === module ? definitions.get(key.declaration.node) : undefined;
      if (definition === undefined) throw new TypeError("front: a computed unique-symbol identity requires its actual ready declaration identity");
      return definition;
    }
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
export function sourceIdentityName(node: Hir.SyntaxNode<Hir.SyntaxPhase>, module: ModuleId,
  properties: ReadonlyMap<NodeId, RawPropertyName>, definitions: ReadonlyMap<NodeId, DefId>): string | null {
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
    case "FunctionDeclaration": case "ClassDeclaration": return node.name === null ? "default" : nameText(node.name, module, properties, definitions);
    case "InterfaceDeclaration": case "TypeAliasDeclaration": case "EnumDeclaration": case "EnumMember": case "ModuleDeclaration":
    case "TypeParameter": case "PropertyDeclaration": case "MethodDeclaration": case "GetAccessor": case "SetAccessor":
    case "PropertySignature": case "MethodSignature": case "NamespaceExport":
      return nameText(node.name, module, properties, definitions);
    default: return null;
  }
}

interface Owner {
  readonly node: NodeId;
  readonly segments: readonly DefinitionSegment[];
}

export function sourcePropertyNames(module: ModuleId, names: readonly RawPropertyName[]): ReadonlyMap<NodeId, RawPropertyName> {
  const properties = new Map<NodeId, RawPropertyName>();
  for (const property of names) {
    if (property.node.module !== module || properties.has(property.node.node))
      throw new TypeError("front: every computed property key belongs once to its actual captured module");
    properties.set(property.node.node, property);
  }
  return properties;
}

/**
 * The definition identities of one module, in the syntax tree's preorder: each declaration's owner is the nearest
 * enclosing declaration that has an identity, and its ordinal counts the declarations of that name in that owner
 * before it, whatever their kind. The counters belong to the owner itself (its node), never to a spelling of its
 * path, so names holding `#`, `/` or `:` cannot make two owners share a counter (K-3343).
 */
export function moduleIdentities(module: ModuleId, tree: Hir.SourceFile<Hir.SyntaxPhase>, propertyNames: readonly RawPropertyName[],
  componentRoots: readonly RawNodeRef[]): ModuleDefinitions {
  const rows: ModuleDefinitionRow[] = [];
  const sourceOccurrences: ModuleDefinitions["sourceOccurrences"][number][] = [];
  const counts = new Map<NodeId, Map<string, number>>();
  const properties = sourcePropertyNames(module, propertyNames);
  const definitions = new Map<NodeId, DefId>();
  const requested = new Set<NodeId>();
  for (const root of componentRoots) {
    if (root.module !== module) throw new TypeError("front: a component root request must retain its actual captured module");
    requested.add(root.node);
  }
  const moduleBody = encodeBodyId({ owner: encodeDefId({ module, segments: [] }), role: "module", ordinal: 0 });
  const pending: { readonly node: Hir.SyntaxNode<Hir.SyntaxPhase>; readonly owner: Owner | null; readonly scope: SourceBodyScope }[] =
    [{ node: tree, owner: null, scope: { body: moduleBody, lexicalBody: moduleBody, callableBody: null } }];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const { node, owner } = next;
    const name = sourceIdentityName(node, module, properties, definitions);
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
      definitions.set(node.id, encodeDefId({ module, segments }));
      inner = { node: node.id, segments };
    }
    const context = requested.size === 0 ? null : enterSourceBody(node, next.scope, definitions);
    if (isModuleBindingKind(node.kind, node.kind !== "ImportClause" || node.name !== null)
      || node.kind === "IndexSignature" || node.kind === "MappedType") {
      if (inner === null) throw new TypeError("front: a binding has no genuine enclosing declaration identity");
      sourceOccurrences.push({ node: node.id, kind: node.kind, occurrence: { kind: "item", value: {
        owner: encodeDefId({ module, segments: inner.segments }), node: node.id } } });
    } else if (context !== null && requested.has(node.id)) {
      sourceOccurrences.push({ node: node.id, kind: node.kind, occurrence: { kind: "body", value: { body: context.body, node: node.id } } });
    }
    requested.delete(node.id);
    const children = childrenOfSyntax(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) pending.push({ node: child, owner: inner, scope: context === null ? next.scope : childSourceBody(context, child) });
    }
  }
  if (requested.size !== 0) throw new TypeError("front: every requested component root must name its actual captured syntax node");
  return { module, rows, sourceOccurrences };
}
