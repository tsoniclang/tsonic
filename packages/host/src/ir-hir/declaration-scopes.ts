import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { DefId, NodeId } from "../ids/contract.js";
import type { BindingScope, NominalDefinition } from "../ir-types/contract.js";
import type { CheckedPhase, DeriveDeclarationScopes, HirNode, ModifierList, NodeList, ParameterDeclaration, TypeParameterDeclaration } from "./contract.js";

interface Inherited {
  readonly available: readonly DefId[];
  readonly selfs: readonly DefId[];
  readonly members: { readonly owner: DefId; readonly node: NodeId; readonly params: readonly DefId[] } | null;
}

const NONE: Inherited = { available: [], selfs: [], members: null };
const EMPTY_SCOPE: BindingScope = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
const PARENT_FIRST: InvariantFailure = { owner: "ir-hir", query: null, origin: null, message: "a node's parent is not before it in the node table" };

function without(list: readonly DefId[], removed: readonly DefId[]): readonly DefId[] {
  const excluded = new Set(removed);
  return list.filter(parameter => !excluded.has(parameter));
}

function ownParameters(list: NodeList<TypeParameterDeclaration<CheckedPhase>> | null): readonly DefId[] {
  return list === null ? [] : list.nodes.map(node => node.tsonic.parameter.declaration);
}

function staticMember(modifiers: ModifierList<CheckedPhase> | null): boolean {
  return modifiers !== null && modifiers.nodes.some(modifier => modifier.kind === "StaticKeyword");
}

function explicitThis(parameters: NodeList<ParameterDeclaration<CheckedPhase>>): boolean {
  const first = parameters.nodes[0];
  return first !== undefined && first.name.kind === "Identifier" && first.name.text === "this";
}

function binder(inherited: Inherited, classFamily: readonly DefId[], own: readonly DefId[], selfs: readonly DefId[],
  available: readonly DefId[] = inherited.available): readonly [BindingScope, Inherited] {
  return [{ classParameters: classFamily, methodParameters: own, capturedParameters: without(available, classFamily), selfOwners: selfs },
    { available: [...available, ...own], selfs, members: null }];
}

function member(inherited: Inherited, isStatic: boolean, own: readonly DefId[], ownThis: boolean,
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
    case "FunctionDeclaration": case "FunctionExpression": case "FunctionType": case "ConstructorType":
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

const INTERFACE_INSTANCE: NominalDefinition = { kind: "declared", facets: ["instance"] };
const ENUM_INSTANCE: NominalDefinition = { kind: "enum", facets: ["instance"] };

export const deriveDeclarationScopes: DeriveDeclarationScopes = (module, nodes) => {
  if (nodes[0] !== module.tree)
    return throwInvariant({ owner: "ir-hir", query: null, origin: null, message: "the node table given with the module is not the module's own" });
  const scopes = environments(nodes);
  const declarations = new Map<DefId, NodeId>([[module.tree.tsonic.definition, module.tree.id]]);
  for (const item of module.items) declarations.set(item.definition, item.node);
  return {
    module,
    bindingScopeOf: definition => {
      const node = declarations.get(definition);
      return node === undefined ? null : scopes[node] ?? null;
    },
    nominalOf: definition => {
      const node = declarations.get(definition);
      const kind = node === undefined ? undefined : nodes[node]?.kind;
      return kind === "InterfaceDeclaration" ? INTERFACE_INSTANCE : kind === "EnumDeclaration" ? ENUM_INSTANCE : null;
    },
  };
};
