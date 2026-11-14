import type { Diagnostic, Result } from "../diag/contract.js";
import type { BodyId, BodyRole, DefId, NodeId, Origin } from "../ids/contract.js";
import type { Declaration, CheckedPhase, HirBody, HirNode } from "../ir-hir/contract.js";
import type { DataflowResult, GraphComponents } from "../dataflow/contract.js";
import type { InferenceGroup, InferredSignaturePart } from "../ir-infer/contract.js";
import type { GroupDeps, GroupsOf } from "./contract.js";
import { requirePresent, resourceLimitDiagnostic } from "../diag/index.js";
import { decodeBodyId, encodeGroupId } from "../ids/index.js";
import { childrenOfSyntax } from "../ir-hir/index.js";
import { inferredPartsOf } from "../ir-infer/index.js";
import { stronglyConnectedComponents } from "../dataflow/index.js";
import { callerDefect, notInferredYet, validateGraphLimits } from "./frontier.js";

const PORT = "GroupsOf";

interface OwnedPart {
  readonly part: InferredSignaturePart;
  readonly body: number;
}

export const partition: GroupsOf = (deps, bodies) => {
  validateGraphLimits(PORT, deps.graph);
  if (bodies.length === 0) return { kind: "ok", value: [], diagnostics: [] };
  let work = 0;
  const take = (count: number): boolean => {
    if (count > deps.graph.maximumWork - work) return false;
    work += count;
    return true;
  };
  const stop = (): Result<readonly InferenceGroup[]> => refused(deps, bodies,
    { kind: "resource-limit", dimension: "work", maximum: deps.graph.maximumWork });
  if (!take(bodies.length)) return stop();
  const order = [...bodies].sort(compareText);
  const index = new Map<BodyId, number>();
  const ready: HirBody[] = [];
  const roles: BodyRole[] = [];
  const items = new Map<DefId, Declaration<CheckedPhase>>();
  for (const body of order) {
    if (index.has(body)) return callerDefect(PORT, "a body occurs twice in the inventory");
    const checked = deps.hirBody(body);
    if (checked.body !== body) return callerDefect(PORT, "a body reads another body's checked input");
    const path = decodeBodyId(body);
    if (path.kind !== "decoded" || path.value.owner !== checked.owner)
      return callerDefect(PORT, "a body does not retain its checked owner");
    index.set(body, ready.length);
    ready.push(checked);
    roles.push(path.value.role);
    if (!items.has(checked.owner)) items.set(checked.owner, deps.itemOf(checked.owner));
  }
  const successors: Set<number>[] = order.map(() => new Set());
  const edge = (from: number, to: number): boolean => {
    const targets = present(successors[from], "the outgoing edges of a body");
    if (!take(1)) return false;
    targets.add(to);
    return true;
  };
  const parent = new Map<BodyId, BodyId>();
  for (const [position, body] of ready.entries()) {
    for (const nested of body.nestedBodies) {
      if (!take(1)) return stop();
      const target = index.get(nested);
      if (target === undefined) return callerDefect(PORT, "a nested body is outside the checked inventory");
      if (nested === body.body || parent.has(nested)) return callerDefect(PORT, "a nested body has no unique enclosing execution");
      parent.set(nested, body.body);
      const inner = present(ready[target], "the checked nested body");
      const owner = present(items.get(inner.owner), "the nested body's declaration");
      const enclosing = present(items.get(body.owner), "the enclosing body's declaration");
      if (owner.kind === "ArrowFunction" || owner.kind === "FunctionExpression"
        || owner.kind === "FunctionDeclaration" && callable(enclosing)) {
        if (!edge(position, target) || !edge(target, position)) return stop();
      }
    }
  }
  const parts: OwnedPart[] = [];
  const definitions = new Map<DefId, number>();
  for (const [position, body] of ready.entries()) {
    const item = present(items.get(body.owner), "the body's declaration");
    if (callable(item) && roles[position] !== "function") return callerDefect(PORT, "a callable execution must retain its function body role");
    const parameters = body.params.filter(parameter => parameter.role !== "this");
    for (const part of inferredPartsOf(body.owner, item)) {
      if (!take(1)) return stop();
      let target = position;
      if (part.part.kind === "parameter-initializer") {
        const parameter = parameters[part.part.index];
        if (parameter === undefined || parameter.initializer === null)
          return callerDefect(PORT, "an inferred parameter part has no actual initializer execution");
        const initializer = index.get(parameter.initializer);
        if (initializer === undefined) return callerDefect(PORT, "an inferred parameter initializer is outside the checked inventory");
        target = initializer;
      }
      parts.push({ part, body: target });
      let declaration = definitions.get(part.definition);
      if (declaration === undefined) {
        if (!take(1)) return stop();
        declaration = successors.length;
        successors.push(new Set());
        definitions.set(part.definition, declaration);
      }
      if (!edge(declaration, target)) return stop();
    }
  }
  for (const [position, body] of ready.entries()) {
    const ownParts = definitions.get(body.owner);
    if (callable(present(items.get(body.owner), "the body's declaration")) && ownParts !== undefined && !edge(position, ownParts)) return stop();
    const excluded = new Set<NodeId>(body.nestedBodies.map(nested => present(ready[present(index.get(nested), "a nested body's index")], "a nested body").root.id));
    const seen = new Set<HirNode>();
    const pending: HirNode[] = [body.root];
    const depend = (definition: DefId): boolean => {
      const target = definitions.get(definition);
      return target === undefined || edge(position, target);
    };
    for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
      if (!take(1)) return stop();
      if (excluded.has(node.id) || seen.has(node)) continue;
      seen.add(node);
      if (node.kind === "Identifier") {
        const name = node.tsonic;
        if (name.role === "value" || name.role === "shorthand-value" || name.role === "type-name" || name.role === "assignment-target") {
          const resolution = name.resolution;
          if (resolution.kind === "declarations") {
            for (const definition of resolution.definitions) if (!depend(definition)) return stop();
          } else if (resolution.kind === "binding" || resolution.kind === "member" || resolution.kind === "unavailable")
            return notInferredYet(PORT, "a qualified binding whose group dependency projection is not implemented", node.origin);
        }
      } else if (node.kind === "PropertyAccessExpression" || node.kind === "ElementAccessExpression") {
        const member = node.tsonic;
        if (member.origins.kind === "unavailable") return notInferredYet(PORT,
          "a member whose actual declaration origins are unavailable (" + member.origins.reason + ")", node.origin);
        for (const origin of member.origins.value) if (origin.kind === "declared" && !depend(origin.declaration)) return stop();
      }
      const children = childrenOfSyntax(node);
      if (!take(children.length)) return stop();
      for (const child of children) pending.push(child);
    }
  }
  const graph = successors.map(targets => [...targets].sort((left, right) => left - right));
  const components = stronglyConnectedComponents({ successors: graph }, { ...deps.graph, maximumWork: deps.graph.maximumWork - work });
  if (components.kind === "resource-limit") return refused(deps, order,
    { ...components, maximum: components.dimension === "work" ? deps.graph.maximumWork : components.maximum });
  return { kind: "ok", value: groupsOf(order, graph, components.value, parts), diagnostics: [] };
};

function groupsOf(order: readonly BodyId[], graph: readonly (readonly number[])[], components: GraphComponents,
  parts: readonly OwnedPart[]): InferenceGroup[] {
  const groups = new Map<number, { id: InferenceGroup["id"]; bodies: BodyId[]; signatures: InferredSignaturePart[] }>();
  for (const [position, members] of components.components.entries()) {
    const bodies = members.filter(member => member < order.length).map(member => present(order[member], "the body of a vertex")).sort(compareText);
    const first = bodies[0];
    if (first !== undefined) groups.set(position, { id: encodeGroupId([first, ...bodies.slice(1)]), bodies, signatures: [] });
  }
  for (const { body, part } of parts)
    present(groups.get(present(components.componentOf[body], "an inferred part's component")), "an inferred part's group").signatures.push(part);
  const dependencies = components.components.map(() => new Set<number>());
  for (const [from, targets] of graph.entries()) {
    const owner = present(components.componentOf[from], "the source component of an edge");
    for (const target of targets) {
      const dependency = present(components.componentOf[target], "the target component of an edge");
      if (owner !== dependency) present(dependencies[owner], "a group's dependencies").add(dependency);
    }
  }
  const seen = new Set<number>();
  const result: InferenceGroup[] = [];
  for (let root = 0; root < dependencies.length; root += 1) {
    const pending = [{ group: root, leave: false }];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      if (next.leave) {
        const group = groups.get(next.group);
        if (group !== undefined) result.push(group);
        continue;
      }
      if (seen.has(next.group)) continue;
      seen.add(next.group);
      pending.push({ ...next, leave: true });
      const targets = [...present(dependencies[next.group], "a group's dependency inventory")].sort((left, right) => right - left);
      for (const group of targets) pending.push({ group, leave: false });
    }
  }
  return result;
}

function callable(node: HirNode): boolean {
  return node.kind === "FunctionDeclaration" || node.kind === "FunctionExpression" || node.kind === "ArrowFunction"
    || node.kind === "MethodDeclaration" || node.kind === "Constructor" || node.kind === "GetAccessor" || node.kind === "SetAccessor";
}

function present<Value>(value: Value | undefined, what: string): Value {
  return requirePresent(value, { owner: "infer", query: null, origin: null, message: PORT + ": " + what + " is missing" });
}

function refused(deps: GroupDeps, order: readonly BodyId[], limit: Exclude<DataflowResult<GraphComponents>, { readonly kind: "complete" }>): Result<readonly InferenceGroup[]> {
  const origin: Origin = deps.hirBody(present(order[0], "the first body of a refused inventory")).root.origin;
  const diagnostic: Diagnostic = resourceLimitDiagnostic({ owner: "infer", limit: "partition graph " + limit.dimension, maximum: limit.maximum,
    site: { kind: "source", origin },
    unit: { request: { query: "groups", key: { kind: "record", fields: [["bodies", [...order]]] } }, position: { kind: "result" } } });
  return { kind: "refused", diagnostics: [diagnostic] };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
