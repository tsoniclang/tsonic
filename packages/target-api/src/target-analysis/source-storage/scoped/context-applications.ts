import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageInvocationInputQuery } from "../graph/invocation-inputs.js";
import type { createSourceStorageGraphQueries, SourceStorageForwardSelection } from "../graph/graph-queries.js";
import type { SourceStorageContextFootprint } from "../graph/context-footprints.js";
import type { SourceStorageContextLocation } from "../graph/context-locations.js";

interface ContextApplicationQueries {
  readonly subject: SourceStorageSubjectQuery;
  readonly invocationInputs: SourceStorageInvocationInputQuery;
  inputsFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined;
  incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
  argumentsFor(node: Node): readonly Node[];
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  implementationsFor(node: Node): ReadonlySet<Node>;
  isInvocation(node: Node): boolean;
  locationFor(subject: SourceStorageSubject): SourceStorageContextLocation | undefined;
  ownerFor(node: Node): Node | undefined;
}

interface ContextBinding {
  readonly kind: "binding";
  readonly subject: SourceStorageSubject;
  readonly candidate: Node;
  readonly invocation: Node;
}

type ContextSubject = SourceStorageSubject | ContextBinding;
type ContextSelection = SourceStorageForwardSelection<ContextSubject, SourceStorageSubject>;

export function createSourceStorageContextApplications(source: TargetSourceProgram, budget: SourceStorageBudget,
  queries: ContextApplicationQueries, graph: ReturnType<typeof createSourceStorageGraphQueries>) {
  const rows = budget.createRows();
  const bindings = new Map<SourceStorageSubject, Map<Node, Map<Node, ContextBinding>>>();
  const selections = new Map<SourceStorageSubject, SourceStorageContextFootprint>();
  const projections = new Map<ContextSubject, Map<Node, (value: SourceStorageSubject) => readonly ContextSelection[] | undefined>>();
  const isPort = (subject: SourceStorageSubject): boolean =>
    (subject.kind === "input" || subject.kind === "receiver") && subject.projection.length === 0;
  const ownsPort = (subject: SourceStorageSubject, candidate: Node): boolean => subject.kind === "receiver"
    ? subject.node === candidate : subject.kind === "input" && !source.ast.is.IsClassDeclaration(candidate) &&
      !source.ast.is.IsClassExpression(candidate) && source.ast.parameters(candidate).includes(subject.node);
  const binding = (subject: SourceStorageSubject, candidate: Node, invocation: Node): ContextBinding | undefined => {
    const candidates = bindings.get(subject);
    const invocations = candidates?.get(candidate);
    const retained = invocations?.get(invocation);
    if (retained !== undefined) return retained;
    if (!rows.add(1 + (candidates === undefined ? 1 : 0) + (invocations === undefined ? 1 : 0))) return undefined;
    const selected = Object.freeze({ kind: "binding" as const, subject, candidate, invocation });
    const calls = invocations ?? new Map<Node, ContextBinding>();
    const owners = candidates ?? new Map<Node, Map<Node, ContextBinding>>();
    calls.set(invocation, selected); owners.set(candidate, calls); bindings.set(subject, owners);
    return selected;
  };
  const instantiate = (port: SourceStorageSubject, candidate: Node, invocation: Node): readonly ContextSelection[] | undefined => {
    if (!ownsPort(port, candidate)) return [];
    const result: ContextSelection[] = [];
    const inputs = queries.invocationInputs(port, candidate, invocation);
    for (const input of inputs.subjects) {
      if (!budget.step()) return undefined;
      if (input === port) { result.push({ kind: "value", value: port }); continue; }
      const selected = inputs.context === "callee" ? binding(input, candidate, invocation) : input;
      if (selected === undefined) return undefined;
      result.push({ kind: "relation", key: selected });
    }
    return budget.failure() === undefined ? result : undefined;
  };
  const projectionFor = (current: ContextSubject, candidate: Node, invocation: Node):
    ((value: SourceStorageSubject) => readonly ContextSelection[] | undefined) | undefined => {
    const candidates = projections.get(current);
    const cached = candidates?.get(candidate);
    if (cached !== undefined) return cached;
    if (!rows.add(candidates === undefined ? 2 : 1)) return undefined;
    const projection = current.kind === "binding"
      ? (value: SourceStorageSubject): readonly ContextSelection[] | undefined => ownsPort(value, candidate)
        ? instantiate(value, candidate, invocation) : [{ kind: "value", value }]
      : (value: SourceStorageSubject): readonly ContextSelection[] | undefined => isPort(value)
        ? instantiate(value, candidate, invocation)
        : queries.ownerFor(value.node) === candidate ? [{ kind: "value", value: current }] : [];
    const selected = candidates ?? new Map<Node, typeof projection>();
    selected.set(candidate, projection);
    projections.set(current, selected);
    return projection;
  };
  const dependencies = graph.fixedPoint<ContextSubject, SourceStorageSubject>((current, _read, emit, forward) => {
    if (current.kind === "binding") {
      const projection = projectionFor(current, current.candidate, current.invocation);
      return projection !== undefined && forward(current.subject, projection);
    }
    if (isPort(current)) return emit(current);
    const location = queries.locationFor(current);
    if (location !== undefined && !emit(current)) return false;
    if (location === "binding") return budget.failure() === undefined;
    const direct = queries.inputsFor(current);
    if (direct === undefined) return false;
    for (const input of direct) if (!budget.step() || !forward(input)) return false;
    if (!queries.isInvocation(current.node)) return budget.failure() === undefined;
    const candidates = queries.implementationsFor(current.node);
    const deferred = [...candidates].some(candidate => source.ast.hasModifierKind(candidate, "async"));
    if (deferred && !emit(current)) return false;
    if (candidates.size === 0 || source.ast.is.IsNewExpression(current.node) || deferred) {
      for (const expression of queries.argumentsFor(current.node)) {
        if (!budget.step()) return false;
        const subject = queries.subjectFor(expression);
        if (subject === undefined || !forward(subject)) return false;
      }
    }
    if (candidates.size === 0) {
      for (const input of queries.incomingFor(current)) if (!budget.step() || !forward(input)) return false;
    }
    for (const candidate of candidates) {
      if (!budget.step()) return false;
      if (source.ast.hasModifierKind(candidate, "async")) continue;
      const result = queries.subject(candidate, "return", current.projection);
      const projection = projectionFor(current, candidate, current.node);
      if (result === undefined || projection === undefined || !forward(result, projection)) return false;
    }
    return budget.failure() === undefined;
  });
  return (subject: SourceStorageSubject): SourceStorageContextFootprint | undefined => {
    if (!queries.isInvocation(subject.node) || !budget.step()) return undefined;
    const cached = selections.get(subject);
    if (cached !== undefined) return cached;
    const values = dependencies(subject);
    if (values === undefined) return undefined;
    const ports = new Set<SourceStorageSubject>();
    const locations = new Set<SourceStorageSubject>();
    for (const value of values) {
      if (!budget.step()) return undefined;
      (isPort(value) ? ports : locations).add(value);
    }
    if (!rows.add(3 + values.size)) return undefined;
    const result = Object.freeze({ ports, locations });
    selections.set(subject, result);
    return result;
  };
}
