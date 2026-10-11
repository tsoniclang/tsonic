import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageInvocationInputQuery } from "./invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "./graph-queries.js";
import type { SourceStorageContextFootprint } from "./context-footprints.js";

interface ContextApplicationQueries {
  readonly subject: SourceStorageSubjectQuery;
  readonly invocationInputs: SourceStorageInvocationInputQuery;
  inputsFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined;
  incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
  argumentsFor(node: Node): readonly Node[];
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  implementationsFor(node: Node): ReadonlySet<Node>;
  isInvocation(node: Node): boolean;
  isLocation(subject: SourceStorageSubject): boolean;
  ownerFor(node: Node): Node | undefined;
}

interface ContextBinding {
  readonly kind: "binding";
  readonly subject: SourceStorageSubject;
  readonly candidate: Node;
  readonly invocation: Node;
}

export function createSourceStorageContextApplications(source: TargetSourceProgram, budget: SourceStorageBudget,
  queries: ContextApplicationQueries, graph: ReturnType<typeof createSourceStorageGraphQueries>) {
  const rows = budget.createRows();
  const bindings = new Map<SourceStorageSubject, Map<Node, Map<Node, ContextBinding>>>();
  const selections = new Map<SourceStorageSubject, SourceStorageContextFootprint>();
  const isPort = (subject: SourceStorageSubject): boolean => subject.kind === "input" || subject.kind === "receiver";
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
  const dependencies = graph.fixedPoint<SourceStorageSubject | ContextBinding, SourceStorageSubject>((current, read, emit) => {
    const forward = (subject: SourceStorageSubject | ContextBinding): boolean => {
      const values = read(subject);
      if (values === undefined) return false;
      for (const value of values) if (!budget.step() || !emit(value)) return false;
      return true;
    };
    const instantiate = (port: SourceStorageSubject, candidate: Node, invocation: Node): boolean => {
      if (!ownsPort(port, candidate)) return true;
      const inputs = queries.invocationInputs(port, candidate, invocation);
      for (const input of inputs.subjects) {
        if (!budget.step()) return false;
        if (input === port) { if (!emit(port)) return false; continue; }
        const selected = inputs.context === "callee" ? binding(input, candidate, invocation) : input;
        if (selected === undefined || !forward(selected)) return false;
      }
      return budget.failure() === undefined;
    };
    if (current.kind === "binding") {
      const values = read(current.subject);
      if (values === undefined) return false;
      for (const value of values) {
        if (!budget.step()) return false;
        if (ownsPort(value, current.candidate)) {
          if (!instantiate(value, current.candidate, current.invocation)) return false;
        } else if (!emit(value)) return false;
      }
      return budget.failure() === undefined;
    }
    if (isPort(current)) return emit(current);
    if (queries.isLocation(current) && !emit(current)) return false;
    const direct = queries.inputsFor(current);
    if (direct === undefined) return false;
    for (const input of direct) if (!budget.step() || !forward(input)) return false;
    if (!queries.isInvocation(current.node)) return budget.failure() === undefined;
    const candidates = queries.implementationsFor(current.node);
    if (candidates.size === 0 || source.ast.is.IsNewExpression(current.node)) {
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
      const result = queries.subject(candidate, "return", current.projection);
      const values = result === undefined ? undefined : read(result);
      if (values === undefined) return false;
      for (const value of values) {
        if (!budget.step()) return false;
        if (isPort(value)) { if (!instantiate(value, candidate, current.node)) return false; }
        else if (queries.ownerFor(value.node) === candidate && !emit(current)) return false;
      }
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
