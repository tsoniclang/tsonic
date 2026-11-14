import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, NodeId } from "../ids/contract.js";
import { decodeDefId } from "../ids/index.js";
import type { CheckedPhase, HirNode, ModifierList, NodeList, ParameterDeclaration, TypeParameterDeclaration } from "../ir-hir/contract.js";
import type { BindingScope, TypeParameterIdentity } from "../ir-types/contract.js";
import type { DeclsModule, DefinitionDescription, DefinitionExport, DefinitionExports, DefinitionTable } from "./contract.js";

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

interface Inherited {
  readonly available: readonly TypeParameterIdentity[];
  readonly selfs: readonly DefId[];
  readonly members: { readonly owner: DefId; readonly node: NodeId; readonly params: readonly TypeParameterIdentity[] } | null;
}

const NONE: Inherited = { available: [], selfs: [], members: null };
const EMPTY_SCOPE: BindingScope = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
const PARENT_FIRST: InvariantFailure = { owner: "decls", query: null, origin: null, message: "a node's parent is not before it in the node table" };

function without(list: readonly TypeParameterIdentity[], removed: readonly TypeParameterIdentity[]): readonly TypeParameterIdentity[] {
  const indices = new Map<DefId, Set<number>>();
  for (const parameter of removed) {
    const family = indices.get(parameter.owner);
    if (family === undefined) indices.set(parameter.owner, new Set([parameter.index]));
    else family.add(parameter.index);
  }
  return list.filter(parameter => indices.get(parameter.owner)?.has(parameter.index) !== true);
}

function ownParameters(list: NodeList<TypeParameterDeclaration<CheckedPhase>> | null): readonly TypeParameterIdentity[] {
  return list === null ? [] : list.nodes.map(node => node.tsonic.parameter.identity);
}

function staticMember(modifiers: ModifierList<CheckedPhase> | null): boolean {
  return modifiers !== null && modifiers.nodes.some(modifier => modifier.kind === "StaticKeyword");
}

function explicitThis(parameters: NodeList<ParameterDeclaration<CheckedPhase>>): boolean {
  const first = parameters.nodes[0];
  return first !== undefined && first.name.kind === "Identifier" && first.name.text === "this";
}

function binder(inherited: Inherited, classFamily: readonly TypeParameterIdentity[], own: readonly TypeParameterIdentity[], selfs: readonly DefId[],
  available: readonly TypeParameterIdentity[] = inherited.available): readonly [BindingScope, Inherited] {
  return [{ classParameters: classFamily, methodParameters: own, capturedParameters: without(available, classFamily), selfOwners: selfs },
    { available: [...available, ...own], selfs, members: null }];
}

function member(inherited: Inherited, isStatic: boolean, own: readonly TypeParameterIdentity[], ownThis: boolean,
  context: NonNullable<Inherited["members"]>): readonly [BindingScope, Inherited] {
  const available = isStatic ? without(inherited.available, context.params) : inherited.available;
  const selfs = ownThis ? [] : isStatic ? inherited.selfs.filter(owner => owner !== context.owner) : inherited.selfs;
  return binder(inherited, isStatic ? [] : context.params, own, selfs, available);
}

function environmentAt(node: HirNode, inherited: Inherited, parent: BindingScope): readonly [BindingScope, Inherited] {
  const context = inherited.members !== null && node.parent === inherited.members.node ? inherited.members : null;
  switch (node.kind) {
    case "SourceFile":
      return [EMPTY_SCOPE, NONE];
    case "ClassDeclaration": case "ClassExpression": case "InterfaceDeclaration": {
      const own = ownParameters(node.typeParameters);
      const selfs = [...inherited.selfs, node.tsonic.definition];
      return [{ classParameters: own, methodParameters: [], capturedParameters: inherited.available, selfOwners: selfs },
        { available: [...inherited.available, ...own], selfs, members: { owner: node.tsonic.definition, node: node.id, params: own } }];
    }
    case "TypeAliasDeclaration": {
      const own = ownParameters(node.typeParameters);
      return [{ classParameters: own, methodParameters: [], capturedParameters: inherited.available, selfOwners: [] },
        { available: [...inherited.available, ...own], selfs: [], members: null }];
    }
    case "MethodDeclaration": case "Constructor": case "GetAccessor": case "SetAccessor": case "MethodSignature": case "CallSignature":
    case "ConstructSignature": case "IndexSignature": {
      const own = ownParameters(node.typeParameters);
      const ownThis = explicitThis(node.parameters);
      if (context !== null) return member(inherited, node.kind !== "CallSignature" && node.kind !== "ConstructSignature" && staticMember(node.modifiers), own, ownThis, context);
      return binder(inherited, [], own, []);
    }
    case "PropertyDeclaration": case "PropertySignature": case "ClassStaticBlockDeclaration":
      if (context === null) return [parent, inherited];
      return member(inherited, node.kind === "ClassStaticBlockDeclaration" || staticMember(node.modifiers), [], false, context);
    case "ArrowFunction":
      return binder(inherited, [], ownParameters(node.typeParameters), inherited.selfs);
    case "FunctionDeclaration": case "FunctionExpression":
      return binder(inherited, [], ownParameters(node.typeParameters), []);
    default:
      return [parent, inherited];
  }
}

function environments(nodes: readonly HirNode[]): readonly BindingScope[] {
  const scopes: BindingScope[] = [];
  const passed: Inherited[] = [];
  for (const node of nodes) {
    const parentScope = node.parent === null ? EMPTY_SCOPE : requirePresent(scopes[node.parent], PARENT_FIRST);
    const parentInherited = node.parent === null ? NONE : requirePresent(passed[node.parent], PARENT_FIRST);
    const [scope, below] = environmentAt(node, parentInherited, parentScope);
    scopes.push(scope);
    passed.push(below);
  }
  return scopes;
}

const defect = (message: string, node: HirNode | null): InvariantFailure =>
  ({ owner: "decls", query: { name: "describeDefinitions", encodedKey: "" }, origin: node === null ? null : node.origin, message });

export function describeDefinitions(checked: DeclsModule, exportNames: readonly DefinitionExports[]): DefinitionTable {
  const { module, nodes } = checked;
  if (nodes[0] !== module.tree) return throwInvariant(defect("the node table given with the module is not the module's own", null));
  const scopes = environments(nodes);
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
    return { definition, path: path.value, kind: node.kind, visibility: visibilityOf(node, nodes), parent, bodies: owned.get(definition) ?? [],
      generics: requirePresent(scopes[node.id], PARENT_FIRST), exports: exportsOf.get(definition) ?? NO_EXPORTS };
  };
  const root = module.tree;
  const definitions: DefinitionDescription[] = [describe(root.tsonic.definition, root.tsonic.parent, root)];
  for (const item of module.items) {
    const node = nodes[item.node];
    if (node === undefined || !Object.is(node.id, item.node))
      return throwInvariant(defect(`declaration entry ${item.definition} names node ${item.node}, which the module does not have`, null));
    const payload = node.tsonic;
    if (payload === null || !("parent" in payload))
      return throwInvariant(defect(`declaration entry ${item.definition} names a ${node.kind} node, which carries no checked declaration`, node));
    definitions.push(describe(item.definition, payload.parent, node));
  }
  return { module: module.module, definitions };
}
