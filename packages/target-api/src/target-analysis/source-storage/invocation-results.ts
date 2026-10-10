import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageIncomingQuery } from "./edges.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageBoundSubject, SourceStorageSubstitutions } from "./substitutions.js";

interface SourceStorageInvocationResultQueries {
  readonly subject: SourceStorageSubjectQuery;
  readonly incomingFor: SourceStorageIncomingQuery;
  implementationsFor(invocation: Node, bindings: SourceStorageSubstitutions): ReadonlySet<Node>;
  valuesFor(subject: SourceStorageSubject, bindings: SourceStorageSubstitutions): readonly SourceStorageBoundSubject[];
  targetFor(invocation: Node): SourceStorageSubject | undefined;
  bindingsFor(candidate: Node, invocation: Node, bindings: SourceStorageSubstitutions,
    captured: SourceStorageSubstitutions): SourceStorageSubstitutions | undefined;
  isAccessor(invocation: Node): boolean;
  isOpaque(invocation: Node): boolean;
  hasResultAlias(invocation: Node): boolean;
}

export interface SourceStorageInvocationResultQueriesContract {
  select(subject: SourceStorageSubject, bindings: SourceStorageSubstitutions): readonly SourceStorageBoundSubject[] | undefined;
  forInvocation(candidate: Node, invocation: Node, bindings: SourceStorageSubstitutions): ReadonlySet<SourceStorageSubstitutions>;
  hasAllocation(subject: SourceStorageSubject): boolean;
}

export function createSourceStorageInvocationResults(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  queries: SourceStorageInvocationResultQueries,
): SourceStorageInvocationResultQueriesContract {
  const hasAllocation = (subject: SourceStorageSubject): boolean => source.ast.is.IsNewExpression(subject.node) &&
    !queries.hasResultAlias(subject.node);
  const forInvocation = (candidate: Node, invocation: Node, bindings: SourceStorageSubstitutions) => {
    const target = queries.targetFor(invocation);
    const values = target === undefined ? [] : queries.valuesFor(target, bindings);
    const captures = new Set<SourceStorageSubstitutions>();
    for (const value of values) {
      if (!budget.step()) break;
      const selected = source.navigation.callableImplementation(value.subject.node);
      if (selected.kind === "resolved" && selected.implementation.declaration === candidate) captures.add(value.bindings);
    }
    if (captures.size === 0) captures.add(bindings);
    const states = new Set<SourceStorageSubstitutions>();
    for (const captured of captures) {
      if (!budget.step()) break;
      const selected = queries.bindingsFor(candidate, invocation, bindings, captured);
      if (selected !== undefined) states.add(selected);
    }
    return states;
  };
  const select = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions) => {
    const node = subject.node;
    const construction = source.ast.is.IsNewExpression(node);
    if (!construction && !source.ast.is.IsCallExpression(node) && !queries.isAccessor(node)) return undefined;
    if (queries.hasResultAlias(node) || !construction && queries.isOpaque(node)) return undefined;
    const inputs: SourceStorageBoundSubject[] = [];
    for (const candidate of queries.implementationsFor(node, bindings)) {
      if (!budget.step()) break;
      const result = queries.subject(candidate, "return", subject.projection);
      if (result === undefined || construction && queries.incomingFor(result).size === 0) continue;
      for (const selected of forInvocation(candidate, node, bindings)) {
        if (!budget.step()) break;
        inputs.push({ subject: result, bindings: selected });
      }
    }
    return inputs.length === 0 ? undefined : inputs;
  };
  return Object.freeze({ select, forInvocation, hasAllocation });
}
