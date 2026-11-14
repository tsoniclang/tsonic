import type { DeclsModule } from "../decls/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, LocalRef, NodeId, SourceNodeRef } from "../ids/contract.js";
import type { HirBody, HirNode } from "../ir-hir/contract.js";
import { childrenOfSyntax } from "../ir-hir/index.js";

export interface CheckedSourceViews {
  readonly bodies: ReadonlyMap<BodyId, HirBody>;
  readonly nodeOf: (reference: SourceNodeRef) => HirNode | null;
  readonly localExists: (reference: LocalRef) => boolean;
  readonly declarationSourceOf: (definition: DefId) => SourceNodeRef | null;
}

interface Namespace {
  readonly module: DeclsModule;
  readonly bodies: readonly (BodyId | null)[];
  readonly items: readonly (DefId | null)[];
}

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

function ordinal(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

export function checkedSourceViews(modules: readonly DeclsModule[]): CheckedSourceViews {
  const bodies = new Map<BodyId, HirBody>();
  const bodyNamespaces = new Map<BodyId, Namespace>();
  const declarations = new Map<DefId, { readonly namespace: Namespace; readonly source: SourceNodeRef }>();
  for (const module of modules) {
    const atBody = new Map<NodeId, BodyId>();
    const atItem = new Map<NodeId, DefId>();
    const bodyOwners: (BodyId | null)[] = [];
    const itemOwners: (DefId | null)[] = [];
    const namespace: Namespace = { module, bodies: bodyOwners, items: itemOwners };
    for (const body of module.module.bodies) {
      if (bodies.has(body.body) || atBody.has(body.root.id))
        return fail("Ready checked executions must have unique body identities and canonical root occurrences.");
      bodies.set(body.body, body);
      bodyNamespaces.set(body.body, namespace);
      atBody.set(body.root.id, body.body);
    }
    const item = (definition: DefId, node: NodeId): void => {
      if (declarations.has(definition) || atItem.has(node))
        fail("Ready checked declarations must have unique identities and source occurrences.");
      atItem.set(node, definition);
      declarations.set(definition, { namespace, source: { kind: "item", value: { owner: definition, node } } });
    };
    item(module.module.tree.tsonic.definition, module.module.tree.id);
    for (const declaration of module.module.items) item(declaration.definition, declaration.node);
    const pending: { readonly node: HirNode; readonly body: BodyId | null; readonly item: DefId | null }[] =
      [{ node: module.module.tree, body: null, item: null }];
    let count = 0;
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      const id = next.node.id;
      if (!ordinal(id) || id !== count || module.nodes[id] !== next.node)
        return fail("A ready source namespace must use its actual dense canonical checked syntax table.");
      const body = atBody.get(id) ?? next.body;
      const owner = atItem.get(id) ?? (atBody.has(id) ? null : next.item);
      bodyOwners.push(body);
      itemOwners.push(owner);
      count += 1;
      const children = childrenOfSyntax(next.node);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child === undefined) return fail("A checked syntax child inventory must not contain a hole.");
        pending.push({ node: child, body, item: owner });
      }
    }
    if (count !== module.nodes.length) return fail("A ready source namespace cannot contain syntax rows outside its actual tree.");
    for (const root of atBody.keys()) if (!ordinal(root) || bodyOwners[root] !== atBody.get(root))
      return fail("A ready execution root must occur in its actual checked tree.");
    for (const [node, definition] of atItem) if (!ordinal(node) || itemOwners[node] !== definition)
      return fail("A ready declaration must occur at its actual checked source node.");
  }
  return {
    bodies,
    nodeOf: reference => {
      const node = reference.value.node;
      if (!ordinal(node)) return null;
      if (reference.kind === "body") {
        const namespace = bodyNamespaces.get(reference.value.body);
        return namespace?.bodies[node] === reference.value.body ? namespace.module.nodes[node] ?? null : null;
      }
      const namespace = declarations.get(reference.value.owner)?.namespace;
      return namespace?.items[node] === reference.value.owner ? namespace.module.nodes[node] ?? null : null;
    },
    localExists: reference => ordinal(reference.local) && bodies.get(reference.body)?.locals[reference.local]?.id === reference.local,
    declarationSourceOf: definition => declarations.get(definition)?.source ?? null,
  };
}
