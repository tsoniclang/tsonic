import type { Diagnostic, Result } from "../diag/contract.js";
import type { BodyId, BodyRole, DefId, NodeId, Origin, SourceNodeRef } from "../ids/contract.js";
import type { Declaration, CheckedPhase, HirBody, HirNode, HirModuleBinding, HirResolution } from "../ir-hir/contract.js";
import type { DataflowAccount, DataflowResult, DataflowStop, GraphComponents } from "../dataflow/contract.js";
import type { InferenceGroup, InferredSignaturePart } from "../ir-infer/contract.js";
import type { GroupDeps, GroupsOf } from "./contract.js";
import { requirePresent, resourceLimitDiagnostic } from "../diag/index.js";
import { decodeBodyId, encodeGroupId } from "../ids/index.js";
import { childrenOfSyntax } from "../ir-hir/index.js";
import { inferredPartsOf } from "../ir-infer/index.js";
import { chargeResultEntries, chargeWork, createAccount, stronglyConnectedComponents } from "../dataflow/index.js";
import { callerDefect, notInferredYet, validateGraphLimits } from "./frontier.js";

const PORT = "GroupsOf";

interface OwnedPart {
  readonly part: InferredSignaturePart;
  readonly body: number;
}

export const partition: GroupsOf = (deps, bodies) => {
  validateGraphLimits(PORT, deps.graph);
  const account = createAccount(deps.graph);
  if (bodies.length === 0) return { kind: "ok", value: [], diagnostics: [] };
  let origin: Origin | null = null;
  let stopped: DataflowStop | undefined;
  const refuse = (limit: DataflowStop): Result<readonly InferenceGroup[]> => refused(bodies, limit, origin);
  const take = (count: number): boolean => {
    const outcome = chargeWork(account, count);
    if (outcome === null) return true;
    stopped = outcome;
    return false;
  };
  const stop = (): Result<readonly InferenceGroup[]> => refuse(present(stopped, "the invocation's original stop"));
  if (!take(bodies.length)) return stop();
  const ordered = orderedRows([...bodies], compareText, account);
  if (ordered.kind !== "complete") return refuse(ordered);
  const order = ordered.value;
  const index = new Map<BodyId, number>();
  const ready: HirBody[] = [];
  const roles: BodyRole[] = [];
  const items = new Map<DefId, Declaration<CheckedPhase>>();
  for (const body of order) {
    if (!take(1)) return stop();
    if (index.has(body)) return callerDefect(PORT, "a body occurs twice in the inventory");
    const checked = deps.hirBody(body);
    origin ??= checked.root.origin;
    if (checked.body !== body) return callerDefect(PORT, "a body reads another body's checked input");
    const path = decodeBodyId(body);
    if (path.kind !== "decoded" || path.value.owner !== checked.owner)
      return callerDefect(PORT, "a body does not retain its checked owner");
    index.set(body, ready.length);
    ready.push(checked);
    roles.push(path.value.role);
    if (!items.has(checked.owner)) items.set(checked.owner, deps.itemOf(checked.owner));
  }
  if (!take(order.length)) return stop();
  const successors: Set<number>[] = order.map(() => new Set());
  const edge = (from: number, to: number): boolean => {
    const targets = present(successors[from], "the outgoing edges of a body");
    if (!take(1)) return false;
    targets.add(to);
    return true;
  };
  const parent = new Map<BodyId, BodyId>();
  for (const [position, body] of ready.entries()) {
    if (!take(1)) return stop();
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
    if (!take(1)) return stop();
    const item = present(items.get(body.owner), "the body's declaration");
    if (callable(item) && roles[position] !== "function") return callerDefect(PORT, "a callable execution must retain its function body role");
    if (!take(body.params.length)) return stop();
    const parameters = body.params.filter(parameter => parameter.role !== "this");
    if (!take(1 + body.params.length)) return stop();
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
  const useResolution = bindingDependencies(deps.bindings, successors, definitions, take, edge);
  if (useResolution === null) return stop();
  for (const [position, body] of ready.entries()) {
    if (!take(1)) return stop();
    const ownParts = definitions.get(body.owner);
    if (callable(present(items.get(body.owner), "the body's declaration")) && ownParts !== undefined && !edge(position, ownParts)) return stop();
    if (!take(body.nestedBodies.length)) return stop();
    const excluded = new Set<NodeId>(body.nestedBodies.map(nested => present(ready[present(index.get(nested), "a nested body's index")], "a nested body").root.id));
    const seen = new Set<HirNode>();
    const pending: HirNode[] = [body.root];
    for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
      if (!take(1)) return stop();
      if (excluded.has(node.id) || seen.has(node)) continue;
      seen.add(node);
      if (node.kind === "Identifier") {
        const name = node.tsonic;
        if (name.role === "value" || name.role === "shorthand-value" || name.role === "type-name" || name.role === "assignment-target") {
          if (!useResolution(position, name.resolution, node.origin)) return stop();
        }
      } else if (node.kind === "PropertyAccessExpression" || node.kind === "ElementAccessExpression") {
        const member = node.tsonic;
        if (member.origins.kind === "unavailable") return notInferredYet(PORT,
          "a member whose actual declaration origins are unavailable (" + member.origins.reason + ")", node.origin);
        for (const origin of member.origins.value) {
          if (!take(1)) return stop();
          const target = origin.kind === "declared" ? definitions.get(origin.declaration) : undefined;
          if (target !== undefined && !edge(position, target)) return stop();
        }
      }
      const children = childrenOfSyntax(node);
      if (!take(children.length)) return stop();
      for (const child of children) pending.push(child);
    }
  }
  const graph: number[][] = [];
  for (const targets of successors) {
    if (!take(1 + targets.size)) return stop();
    const orderedTargets = orderedRows([...targets], (left, right) => left - right, account);
    if (orderedTargets.kind !== "complete") return refuse(orderedTargets);
    graph.push(orderedTargets.value);
  }
  const components = stronglyConnectedComponents({ successors: graph }, account);
  if (components.kind !== "complete") return refuse(components);
  const groups = groupsOf(order, graph, components.value, parts, account);
  return groups.kind === "complete" ? { kind: "ok", value: groups.value, diagnostics: [] } : refuse(groups);
};

interface BindingVertex {
  readonly row: HirModuleBinding;
  readonly vertex: number;
  expanded: boolean;
}

function bindingDependencies(tables: GroupDeps["bindings"], successors: Set<number>[], definitions: ReadonlyMap<DefId, number>,
  take: (count: number) => boolean, edge: (from: number, to: number) => boolean):
  ((from: number, target: HirResolution, origin: Origin) => boolean) | null {
  const items = new Map<DefId, Map<NodeId, BindingVertex>>();
  const bodies = new Map<BodyId, Map<NodeId, BindingVertex>>();
  const ordinal = (reference: SourceNodeRef): NodeId => {
    const node = reference.value.node;
    if (!Number.isSafeInteger(node) || node < 0 || Object.is(node, -0))
      return callerDefect(PORT, "a binding must retain its actual qualified syntax identity");
    return node;
  };
  for (const rows of tables) {
    if (!take(1)) return null;
    for (const row of rows) {
      if (!take(1)) return null;
      const occurrence = row.occurrence;
      const node = ordinal(occurrence);
      const entries = occurrence.kind === "item" ? items.get(occurrence.value.owner) : bodies.get(occurrence.value.body);
      const entry: BindingVertex = { row, vertex: successors.length, expanded: false };
      if (entries === undefined) {
        const nodes = new Map([[node, entry]]);
        if (occurrence.kind === "item") items.set(occurrence.value.owner, nodes);
        else bodies.set(occurrence.value.body, nodes);
      } else {
        if (entries.has(node)) return callerDefect(PORT, "a qualified binding occurrence has duplicate nearest rows");
        entries.set(node, entry);
      }
      successors.push(new Set());
    }
  }
  const bindingOf = (occurrence: SourceNodeRef): BindingVertex => {
    const node = ordinal(occurrence);
    const entry = occurrence.kind === "item" ? items.get(occurrence.value.owner)?.get(node) : bodies.get(occurrence.value.body)?.get(node);
    return entry ?? callerDefect(PORT, "a binding demand must name an actual ready nearest row");
  };
  const declaration = (from: number, definition: DefId): boolean => {
    if (!take(1)) return false;
    const target = definitions.get(definition);
    return target === undefined || edge(from, target);
  };
  return (from, target, origin) => {
    const pending = [{ from, target }];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      const actual = next.target;
      switch (actual.kind) {
        case "binding": {
          const binding = bindingOf(actual.occurrence);
          if (!edge(next.from, binding.vertex)) return false;
          if (binding.expanded) break;
          if (!take(1)) return false;
          binding.expanded = true;
          const nearest = binding.row.target;
          if (nearest.kind === "unavailable")
            return notInferredYet(PORT, "a binding whose actual nearest target is unavailable (" + nearest.reason + ")", origin);
          pending.push({ from: binding.vertex, target: nearest.value });
          break;
        }
        case "declarations":
          for (const definition of actual.definitions) if (!declaration(next.from, definition)) return false;
          break;
        case "member":
          if (actual.origins.kind === "unavailable") return notInferredYet(PORT,
            "a binding member whose actual declaration origins are unavailable (" + actual.origins.reason + ")", origin);
          for (const member of actual.origins.value) {
            if (!take(1)) return false;
            if (member.kind === "declared" && !declaration(next.from, member.declaration)) return false;
          }
          break;
        case "unavailable":
          return notInferredYet(PORT, "a checked resolution whose actual dependency evidence is unavailable (" + actual.reason + ")", origin);
        case "local": case "module": case "unresolved": break;
      }
    }
    return true;
  };
}

function groupsOf(order: readonly BodyId[], graph: readonly (readonly number[])[], components: GraphComponents,
  parts: readonly OwnedPart[], account: DataflowAccount): DataflowResult<InferenceGroup[]> {
  const groups = new Map<number, { id: InferenceGroup["id"]; bodies: BodyId[]; signatures: InferredSignaturePart[] }>();
  for (const [position, members] of components.components.entries()) {
    const componentStop = chargeWork(account, 1);
    if (componentStop !== null) return componentStop;
    let bodies: [BodyId, ...BodyId[]] | null = null;
    for (const member of members) {
      const memberStop = chargeWork(account, 1);
      if (memberStop !== null) return memberStop;
      if (member >= order.length) continue;
      const bodyStop = chargeResultEntries(account, 1);
      if (bodyStop !== null) return bodyStop;
      const body = present(order[member], "the body of a vertex");
      if (bodies === null) bodies = [body];
      else bodies.push(body);
    }
    if (bodies !== null) {
      const identityStop = chargeWork(account, bodies.length);
      if (identityStop !== null) return identityStop;
      const groupStop = chargeResultEntries(account, 1);
      if (groupStop !== null) return groupStop;
      groups.set(position, { id: encodeGroupId(bodies), bodies, signatures: [] });
    }
  }
  for (const { body, part } of parts) {
    const workStop = chargeWork(account, 1);
    if (workStop !== null) return workStop;
    const partStop = chargeResultEntries(account, 1);
    if (partStop !== null) return partStop;
    present(groups.get(present(components.componentOf[body], "an inferred part's component")), "an inferred part's group").signatures.push(part);
  }
  const dependencyStop = chargeWork(account, components.components.length);
  if (dependencyStop !== null) return dependencyStop;
  const dependencies = components.components.map(() => new Set<number>());
  for (const [from, targets] of graph.entries()) {
    const rowStop = chargeWork(account, 1);
    if (rowStop !== null) return rowStop;
    const owner = present(components.componentOf[from], "the source component of an edge");
    for (const target of targets) {
      const edgeStop = chargeWork(account, 1);
      if (edgeStop !== null) return edgeStop;
      const dependency = present(components.componentOf[target], "the target component of an edge");
      if (owner !== dependency) present(dependencies[owner], "a group's dependencies").add(dependency);
    }
  }
  const seen = new Set<number>();
  const result: InferenceGroup[] = [];
  for (let root = 0; root < dependencies.length; root += 1) {
    const rootStop = chargeWork(account, 1);
    if (rootStop !== null) return rootStop;
    const pending = [{ group: root, leave: false }];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      const visitStop = chargeWork(account, 1);
      if (visitStop !== null) return visitStop;
      if (next.leave) {
        const group = groups.get(next.group);
        if (group !== undefined) result.push(group);
        continue;
      }
      if (seen.has(next.group)) continue;
      seen.add(next.group);
      pending.push({ ...next, leave: true });
      const targets = present(dependencies[next.group], "a group's dependency inventory");
      const targetsStop = chargeWork(account, targets.size);
      if (targetsStop !== null) return targetsStop;
      const orderedTargets = orderedRows([...targets], (left, right) => right - left, account);
      if (orderedTargets.kind !== "complete") return orderedTargets;
      for (const group of orderedTargets.value) {
        const pendingStop = chargeWork(account, 1);
        if (pendingStop !== null) return pendingStop;
        pending.push({ group, leave: false });
      }
    }
  }
  return { kind: "complete", value: result };
}

function orderedRows<Value>(values: Value[], compare: (left: Value, right: Value) => number,
  account: DataflowAccount): DataflowResult<Value[]> {
  let rows = values;
  let buffer: Value[] = [];
  for (let width = 1; width < rows.length; width *= 2) {
    const passStop = chargeWork(account, 1);
    if (passStop !== null) return passStop;
    buffer.length = 0;
    for (let start = 0; start < rows.length; start += 2 * width) {
      let left = start;
      let right = Math.min(start + width, rows.length);
      const middle = right;
      const end = Math.min(start + 2 * width, rows.length);
      while (left < middle || right < end) {
        const stepStop = chargeWork(account, 1);
        if (stepStop !== null) return stepStop;
        if (right === end || left < middle && compare(present(rows[left], "sort left"), present(rows[right], "sort right")) <= 0)
          buffer.push(present(rows[left++], "sort left"));
        else buffer.push(present(rows[right++], "sort right"));
      }
    }
    const previous = rows;
    rows = buffer;
    buffer = previous;
  }
  return { kind: "complete", value: rows };
}

function callable(node: HirNode): boolean {
  return node.kind === "FunctionDeclaration" || node.kind === "FunctionExpression" || node.kind === "ArrowFunction"
    || node.kind === "MethodDeclaration" || node.kind === "Constructor" || node.kind === "GetAccessor" || node.kind === "SetAccessor";
}

function present<Value>(value: Value | undefined, what: string): Value {
  return requirePresent(value, { owner: "infer", query: null, origin: null, message: PORT + ": " + what + " is missing" });
}

function refused(order: readonly BodyId[], limit: DataflowStop, origin: Origin | null): Result<readonly InferenceGroup[]> {
  if (limit.kind === "refused") return limit;
  const diagnostic: Diagnostic = resourceLimitDiagnostic({ owner: "infer", limit: "partition graph " + limit.dimension, maximum: limit.maximum,
    site: origin === null ? { kind: "none" } : { kind: "source", origin },
    unit: { request: { query: "groups", key: { kind: "record", fields: [["bodies", order]] } }, position: { kind: "result" } } });
  return { kind: "refused", diagnostics: [diagnostic] };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
