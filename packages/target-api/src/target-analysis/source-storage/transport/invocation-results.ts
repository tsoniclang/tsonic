import type { Node } from "@tsonic/tsts";
import { sourceStorageInstanceCaptures } from "../model/construction.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageScopedSubject, SourceStorageScope } from "../graph/scoped-model.js";

interface SourceStorageInvocationResultQueries {
  readonly subject: SourceStorageSubjectQuery;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  nativeConstructorsFor(subject: SourceStorageSubject): readonly Node[] | undefined;
  valuesFor(subject: SourceStorageSubject, bindings: SourceStorageScope): ReadonlySet<SourceStorageScopedSubject> | undefined;
  targetFor(invocation: Node): SourceStorageSubject | undefined;
  bindingsFor(candidate: Node, invocation: Node, bindings: SourceStorageScope,
    captured: SourceStorageScope, callee: SourceStorageSubject | undefined): SourceStorageScope | undefined;
  hasResultAlias(invocation: Node): boolean;
}

export interface SourceStorageInvocationResultQueriesContract {
  forInvocation(candidate: Node, invocation: Node, bindings: SourceStorageScope,
    capture?: SourceStorageScopedSubject): ReadonlySet<SourceStorageScope>;
  hasAllocation(subject: SourceStorageSubject): boolean;
}

export function createSourceStorageInvocationResults(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  queries: SourceStorageInvocationResultQueries,
): SourceStorageInvocationResultQueriesContract {
  const hasAllocation = (subject: SourceStorageSubject): boolean => source.ast.is.IsNewExpression(subject.node) &&
    !queries.hasResultAlias(subject.node);
  const forInvocation = (candidate: Node, invocation: Node, bindings: SourceStorageScope, capture?: SourceStorageScopedSubject) => {
    const target = queries.targetFor(invocation);
    const states = new Set<SourceStorageScope>();
    const consumer = source.semantics.forNode(invocation);
    const selected = consumer.operations.call(invocation);
    const contract = selected?.sourceSelectedSignatureKind === "resolved"
      ? consumer.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
    if (capture === undefined && contract === candidate && source.ast.body(candidate) === undefined) {
      const selected = queries.bindingsFor(candidate, invocation, bindings, bindings, target);
      if (selected !== undefined) states.add(selected);
      return states;
    }
    if (target === undefined) {
      if (capture !== undefined) return states;
      const selected = queries.bindingsFor(candidate, invocation, bindings, bindings, undefined);
      if (selected !== undefined) states.add(selected);
      return states;
    }
    const values = queries.valuesFor(target, bindings);
    if (values === undefined) return states;
    const owner = source.ast.is.IsConstructorDeclaration(candidate) ? source.ast.parent(candidate) : candidate;
    const captures = new Set<SourceStorageScopedSubject>();
    if (owner !== undefined && (source.ast.is.IsClassDeclaration(owner) || source.ast.is.IsClassExpression(owner))) {
      const selected = sourceStorageInstanceCaptures(source, budget, candidate, values, queries);
      if (selected === undefined) return states;
      for (const value of selected) captures.add(value);
    } else for (const value of values) {
      if (!budget.step()) break;
      const selected = source.navigation.callableImplementation(value.subject.node);
      if (selected.kind === "resolved" && selected.implementation.declaration === candidate) captures.add(value);
    }
    for (const captured of captures) {
      if (!budget.step()) break;
      if (capture !== undefined && (captured.subject !== capture.subject || captured.bindings !== capture.bindings)) continue;
      const selected = queries.bindingsFor(candidate, invocation, bindings, captured.bindings, captured.subject);
      if (selected !== undefined) states.add(selected);
    }
    return states;
  };
  return Object.freeze({ forInvocation, hasAllocation });
}
