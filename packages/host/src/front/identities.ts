import type { DefId, DefinitionSegment, ModuleId, NodeId } from "../ids/contract.js";
import type { LowerModuleDefinitionsDeps, ModuleDefinitionRow, ModuleDefinitions, RawModule, RawNodeRef, RawPropertyName } from "./contract.js";
import { encodeBodyId, encodeDefId, encodeKey } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import { childrenOfSyntax, isModuleBindingKind } from "../ir-hir/index.js";
import { childSourceBody, enterSourceBody, layoutSourceRoles } from "./source-bodies.js";
import type { LayoutSourceRoles, SourceBodyScope, SourceBodyTransition } from "./source-bodies.js";

type SourceIdentityName = string | RawNodeRef;

interface ModuleDefinitionsInput {
  readonly module: RawModule;
  readonly componentRoots: readonly RawNodeRef[];
}

function nameText(name: Hir.SyntaxNode<Hir.SyntaxPhase>,
  properties: ReadonlyMap<NodeId, RawPropertyName>): SourceIdentityName | null {
  switch (name.kind) {
    case "Identifier": case "PrivateIdentifier": case "StringLiteral": case "NumericLiteral": return name.text;
    case "ComputedPropertyName": {
      const property = properties.get(name.id);
      if (property === undefined) throw new TypeError("front: a computed declaration requires its actual captured property-key state");
      const selected = property.selected;
      if (selected.kind === "unavailable" || selected.value === null) return "";
      const key = selected.value;
      if (key.kind === "text") return key.value;
      if (key.kind === "numeric") return String(key.value);
      return key.declaration;
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
export function sourceIdentityName(node: Hir.SyntaxNode<Hir.SyntaxPhase>,
  properties: ReadonlyMap<NodeId, RawPropertyName>, layout: LayoutSourceRoles | null): SourceIdentityName | null {
  switch (node.kind) {
    case "SourceFile":
    case "FunctionExpression": case "ArrowFunction": case "ClassExpression":
    case "Constructor": case "ClassStaticBlockDeclaration": case "CallSignature": case "ConstructSignature": case "FunctionType":
    case "ConstructorType": case "IndexSignature":
      return "";
    case "CallExpression": return layout?.declarations.has(node.id) === true ? "" : null;
    case "ExportAssignment": return node.isExportEquals ? "export=" : "default";
    case "Parameter": return node.name.kind === "Identifier" ? node.name.text : "";
    case "VariableDeclaration": case "BindingElement": {
      const name = node.name;
      return name !== null && name.kind === "Identifier" ? name.text : null;
    }
    case "FunctionDeclaration": case "ClassDeclaration": return node.name === null ? "default" : nameText(node.name, properties);
    case "InterfaceDeclaration": case "TypeAliasDeclaration": case "EnumDeclaration": case "EnumMember": case "ModuleDeclaration":
    case "TypeParameter": case "PropertyDeclaration": case "MethodDeclaration": case "GetAccessor": case "SetAccessor":
    case "PropertySignature": case "MethodSignature": case "NamespaceExport":
      return nameText(node.name, properties);
    default: return null;
  }
}

interface IdentityPlan {
  readonly module: ModuleId;
  readonly node: NodeId;
  readonly kind: Hir.SyntaxKind;
  readonly enclosing: IdentityPlan | null;
  readonly name: SourceIdentityName;
  readonly ordinal: number;
  ready: ModuleDefinitionRow | null;
  entered: boolean;
}

interface IdentityModule {
  readonly input: ModuleDefinitionsInput;
  readonly layout: LayoutSourceRoles | null;
  readonly nodes: readonly { readonly node: Hir.SyntaxNode<Hir.SyntaxPhase>; readonly owner: IdentityPlan | null }[];
  readonly plans: ReadonlyMap<NodeId, IdentityPlan>;
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

function sourceShape(node: Hir.SyntaxNode<Hir.SyntaxPhase>):
  Pick<ModuleDefinitions["sourceOccurrences"][number], "typeSyntax" | "explicitReceiver"> {
  if (node.kind === "Parameter" && node.name.kind === "Identifier" && node.name.text === "this")
    return { explicitReceiver: true };
  if (node.kind === "TupleType") return { typeSyntax: { kind: "tuple",
    spreadOperands: node.elements.nodes.map(element => element.kind === "RestType" ? element.type.id : null) } };
  if (node.kind === "ParenthesizedType" || node.kind === "TypeOperator" && node.operator === "ReadonlyKeyword")
    return { typeSyntax: { kind: "tuple-wrapper", target: node.type.id } };
  if (node.kind === "TypeOperator" && node.operator === "KeyOfKeyword") return { typeSyntax: { kind: "keyof", target: node.type.id } };
  if (node.kind === "ConditionalType") return { typeSyntax: {
    kind: "conditional", check: node.checkType.id, extends: node.extendsType.id, whenTrue: node.trueType.id, whenFalse: node.falseType.id } };
  if (node.kind === "PropertySignature" && node.type !== null)
    return { typeSyntax: { kind: "property-annotation", type: node.type.id } };
  if (node.kind === "IndexedAccessType") return { typeSyntax: { kind: "indexed", index: node.indexType.id } };
  if (node.kind === "TypeAliasDeclaration") return { typeSyntax: { kind: "alias", result: node.type.id,
    parameters: node.typeParameters?.nodes.map(parameter => parameter.id) ?? [] } };
  if (node.kind === "MappedType") return { typeSyntax: { kind: "mapped", parameter: node.typeParameter.id,
    domain: node.typeParameter.constraint?.id ?? null, remap: node.nameType?.id ?? null, value: node.type?.id ?? null,
    readonly: node.readonlyToken === null ? "preserve" : node.readonlyToken.kind === "MinusToken" ? "remove" : "add",
    optional: node.questionToken === null ? "preserve" : node.questionToken.kind === "MinusToken" ? "remove" : "add" } };
  if (node.kind === "TypeReference") return { typeSyntax: { kind: "type-reference", arguments: node.typeArguments?.nodes.map(argument => argument.id) ?? [] } };
  if (node.kind === "UnionType") return { typeSyntax: { kind: "union", members: node.types.nodes.map(member => member.id) } };
  if (node.kind === "IntersectionType") return { typeSyntax: { kind: "intersection", members: node.types.nodes.map(member => member.id) } };
  return {};
}

/**
 * The definition identities of one module, in the syntax tree's preorder: each declaration's owner is the nearest
 * enclosing declaration that has an identity, and its ordinal counts the declarations of that name in that owner
 * before it, whatever their kind. The counters belong to the owner itself (its node), never to a spelling of its
 * path, so names holding `#`, `/` or `:` cannot make two owners share a counter (K-3343).
 */
function planModule(input: ModuleDefinitionsInput): IdentityModule {
  const { module, tree, propertyNames } = input.module;
  const layout = layoutSourceRoles(input.module);
  const counts = new Map<NodeId, Map<string, number>>();
  const properties = sourcePropertyNames(module, propertyNames);
  const plans = new Map<NodeId, IdentityPlan>();
  const nodes: IdentityModule["nodes"][number][] = [];
  const pending: IdentityModule["nodes"][number][] = [{ node: tree, owner: null }];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const { node, owner } = next;
    const name = sourceIdentityName(node, properties, layout);
    let inner = owner;
    if (name !== null) {
      let ordinal = 0;
      if (owner !== null) {
        const names = counts.get(owner.node) ?? new Map<string, number>();
        const key = typeof name === "string" ? encodeKey([name]) : encodeKey([name.module, name.node]);
        ordinal = names.get(key) ?? 0;
        names.set(key, ordinal + 1);
        counts.set(owner.node, names);
      }
      inner = { module, node: node.id, kind: node.kind, enclosing: owner, name, ordinal, ready: null, entered: false };
      if (plans.has(node.id)) throw new TypeError("front: a declaration identity must have its own actual syntax row");
      plans.set(node.id, inner);
    }
    nodes.push({ node, owner: inner });
    const children = childrenOfSyntax(node);
    for (let index = children.length - 1; index >= 0; --index) {
      const child = children[index];
      if (child !== undefined) pending.push({ node: child, owner: inner });
    }
  }
  return { input, layout, nodes, plans };
}

function settleIdentity(root: IdentityPlan, modules: ReadonlyMap<ModuleId, IdentityModule>): void {
  if (root.ready !== null) return;
  const pending = [root];
  root.entered = true;
  while (pending.length !== 0) {
    const next = pending.at(-1);
    if (next === undefined) throw new TypeError("front: a pending declaration requires its actual identity plan");
    const key = typeof next.name === "string" ? null : modules.get(next.name.module)?.plans.get(next.name.node);
    if (key === undefined) throw new TypeError("front: a computed unique-symbol identity requires its actual captured declaration");
    const dependency = next.enclosing !== null && next.enclosing.ready === null ? next.enclosing
      : key !== null && key.ready === null ? key : null;
    if (dependency !== null) {
      if (dependency.entered) throw new TypeError("front: a declaration identity depends on itself");
      dependency.entered = true;
      pending.push(dependency);
      continue;
    }
    let segments: readonly DefinitionSegment[] = [];
    if (next.enclosing !== null) {
      const owner = next.enclosing.ready;
      const name = typeof next.name !== "string" ? key?.ready?.definition
        : next.name.startsWith("D[") || next.name.startsWith("\\") ? "\\" + next.name : next.name;
      if (owner === null || name === undefined) throw new TypeError("front: a declaration identity requires its actual ready owner and name");
      segments = [...owner.segments, { name, ordinal: next.ordinal }];
    }
    next.ready = { node: next.node, kind: next.kind, segments, definition: encodeDefId({ module: next.module, segments }) };
    pending.pop();
  }
}

function completeModule(plan: IdentityModule): ModuleDefinitions {
  const { input, layout, nodes, plans } = plan;
  const { module } = input.module;
  const rows: ModuleDefinitionRow[] = [];
  const sourceOccurrences: ModuleDefinitions["sourceOccurrences"][number][] = [];
  const definitions = new Map<NodeId, DefId>();
  for (const identity of plans.values()) {
    if (identity.ready === null) throw new TypeError("front: a module cannot publish incomplete declaration identities");
    rows.push(identity.ready);
    definitions.set(identity.node, identity.ready.definition);
  }
  const requested = new Set<NodeId>();
  for (const root of input.componentRoots) {
    if (root.module !== module) throw new TypeError("front: a component root request must retain its actual captured module");
    requested.add(root.node);
  }
  const moduleBody = encodeBodyId({ owner: encodeDefId({ module, segments: [] }), role: "module", ordinal: 0 });
  const moduleScope: SourceBodyScope = { body: moduleBody, lexicalBody: moduleBody, callableBody: null };
  const ancestry: { readonly node: NodeId; readonly context: SourceBodyTransition }[] = [];
  for (const { node, owner } of nodes) {
    let context: SourceBodyTransition | null = null;
    if (requested.size !== 0) {
      while (ancestry.length !== 0 && ancestry.at(-1)?.node !== node.parent) ancestry.pop();
      const parent = ancestry.at(-1);
      if (node.parent !== null && parent === undefined)
        throw new TypeError("front: a source occurrence requires its actual qualified parent");
      const scope = parent === undefined ? moduleScope : childSourceBody(parent.context, node, layout?.operands ?? null);
      context = enterSourceBody(node, scope, definitions, layout);
      ancestry.push({ node: node.id, context });
    }
    if (isModuleBindingKind(node.kind, node.kind !== "ImportClause" || node.name !== null)
      || node.kind === "IndexSignature" || node.kind === "MappedType") {
      const identity = owner?.ready;
      if (identity == null) throw new TypeError("front: a binding has no genuine enclosing declaration identity");
      sourceOccurrences.push({ node: node.id, parent: node.parent, kind: node.kind, origin: node.origin, ...sourceShape(node), occurrence: { kind: "item", value: {
        owner: identity.definition, node: node.id } } });
    } else if (context !== null && requested.has(node.id)) {
      sourceOccurrences.push({ node: node.id, parent: node.parent, kind: node.kind, origin: node.origin, ...sourceShape(node),
        occurrence: { kind: "body", value: { body: context.body, node: node.id } } });
    }
    requested.delete(node.id);
  }
  if (requested.size !== 0) throw new TypeError("front: every requested component root must name its actual captured syntax node");
  return { module, rows, sourceOccurrences };
}

export function programIdentities(deps: LowerModuleDefinitionsDeps, inputs: readonly RawModule[]): readonly ModuleDefinitions[] {
  const modules = new Map<ModuleId, IdentityModule>();
  for (const raw of inputs) {
    const module = raw.module;
    if (modules.has(module)) throw new TypeError("front: an identity inventory cannot repeat a module");
    modules.set(module, planModule({ module: raw, componentRoots: deps.componentRootsOf(module) }));
  }
  for (const plan of modules.values())
    for (const identity of plan.plans.values()) settleIdentity(identity, modules);
  return Array.from(modules.values(), completeModule);
}
