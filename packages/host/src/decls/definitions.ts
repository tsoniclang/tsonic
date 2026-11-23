import type { InvariantFailure } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId } from "../ids/contract.js";
import { decodeDefId, encodeDefId } from "../ids/index.js";
import type { CheckedPhase, HirNode, ModifierList } from "../ir-hir/contract.js";
import { checkedLayoutConstructionOf } from "../ir-hir/index.js";
import type { DefinitionDescription, DefinitionExport, DescribeDefinitions } from "./contract.js";

const NO_EXPORTS: readonly DefinitionExport[] = [];

type Visibility = DefinitionDescription["visibility"];

function accessibility(modifiers: ModifierList<CheckedPhase> | null, privateName: boolean): "public" | "protected" | "private" {
  if (privateName) return "private";
  for (const modifier of modifiers === null ? [] : modifiers.nodes) {
    if (modifier.kind === "PrivateKeyword") return "private";
    if (modifier.kind === "ProtectedKeyword") return "protected";
  }
  return "public";
}

function declaresProperty(modifiers: ModifierList<CheckedPhase> | null): boolean {
  return modifiers !== null && modifiers.nodes.some(modifier => modifier.kind === "PublicKeyword" || modifier.kind === "PrivateKeyword" ||
    modifier.kind === "ProtectedKeyword" || modifier.kind === "ReadonlyKeyword" || modifier.kind === "OverrideKeyword");
}

function visibilityOf(node: HirNode, nodes: readonly HirNode[]): Visibility {
  const parent = node.parent === null ? undefined : nodes[node.parent];
  if (parent === undefined) return null;
  const inClass = parent.kind === "ClassDeclaration" || parent.kind === "ClassExpression";
  switch (node.kind) {
    case "PropertyDeclaration": case "MethodDeclaration": case "GetAccessor": case "SetAccessor":
      return inClass ? accessibility(node.modifiers, node.name.kind === "PrivateIdentifier") : null;
    case "Constructor": case "IndexSignature":
      return inClass ? accessibility(node.modifiers, false) : null;
    case "Parameter":
      return parent.kind === "Constructor" && declaresProperty(node.modifiers) ? accessibility(node.modifiers, false) : null;
    default:
      return null;
  }
}

const defect = (message: string, node: HirNode | null): InvariantFailure =>
  ({ owner: "decls", query: { name: "describeDefinitions", encodedKey: "" }, origin: node === null ? null : node.origin, message });

export const describeDefinitions: DescribeDefinitions = (checked, scopes, exportNames) => {
  const { module, nodes } = checked;
  if (nodes[0] !== module.tree) return throwInvariant(defect("the node table given with the module is not the module's own", null));
  if (scopes.module !== module) return throwInvariant(defect("declaration scopes must come from the same verified checked module", null));
  const definitionsHere = new Set<DefId>([module.tree.tsonic.definition, ...module.items.map(item => item.definition)]);
  const exportsOf = new Map<DefId, readonly DefinitionExport[]>();
  for (const entry of exportNames) {
    if (exportsOf.has(entry.definition)) return throwInvariant(defect(`two export-name entries for ${entry.definition}`, null));
    if (!definitionsHere.has(entry.definition)) return throwInvariant(defect(`an export-name entry for ${entry.definition}, which is not a definition of this module`, null));
    exportsOf.set(entry.definition, entry.exports);
  }
  const owned = new Map<DefId, BodyId[]>();
  for (const body of module.bodies) {
    const list = owned.get(body.owner);
    if (list === undefined) owned.set(body.owner, [body.body]);
    else list.push(body.body);
  }
  const describe = (definition: DefId, parent: DefId | null, node: HirNode): DefinitionDescription => {
    const path = decodeDefId(definition);
    if (path.kind !== "decoded") return throwInvariant(defect(`definition identity ${definition} does not decode`, node));
    const generics = scopes.bindingScopeOf(definition);
    if (generics === null) return throwInvariant(defect("a checked definition must have its verified declaration scope", node));
    return { definition, path: path.value, kind: node.kind, visibility: visibilityOf(node, nodes), parent, bodies: owned.get(definition) ?? [],
      generics, exports: exportsOf.get(definition) ?? NO_EXPORTS };
  };
  const root = module.tree;
  const definitions: DefinitionDescription[] = [describe(root.tsonic.definition, root.tsonic.parent, root)];
  for (const item of module.items) {
    const node = nodes[item.node];
    if (node === undefined || !Object.is(node.id, item.node))
      return throwInvariant(defect(`declaration entry ${item.definition} names node ${item.node}, which the module does not have`, null));
    const payload = node.tsonic;
    if (checkedLayoutConstructionOf(node) !== null) {
      const path = decodeDefId(item.definition);
      if (path.kind !== "decoded" || path.value.segments.length === 0)
        return throwInvariant(defect("a layout constructor needs its own checked declaration path", node));
      const { module, segments } = path.value;
      definitions.push(describe(item.definition, encodeDefId({ module, segments: segments.slice(0, -1) }), node));
      continue;
    }
    if (payload === null || !("parent" in payload))
      return throwInvariant(defect(`declaration entry ${item.definition} names a ${node.kind} node, which carries no checked declaration`, node));
    definitions.push(describe(item.definition, payload.parent, node));
  }
  return { module: module.module, definitions };
};
