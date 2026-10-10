import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageBoundSubject, SourceStorageSubstitutions } from "./substitutions.js";

interface SourceStorageInvocationResultQueries {
  readonly subject: SourceStorageSubjectQuery;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  valuesFor(subject: SourceStorageSubject, bindings: SourceStorageSubstitutions): ReadonlySet<SourceStorageBoundSubject> | undefined;
  targetFor(invocation: Node): SourceStorageSubject | undefined;
  bindingsFor(candidate: Node, invocation: Node, bindings: SourceStorageSubstitutions,
    captured: SourceStorageSubstitutions): SourceStorageSubstitutions | undefined;
  hasResultAlias(invocation: Node): boolean;
}

export interface SourceStorageInvocationResultQueriesContract {
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
  const instanceCaptures = (candidate: Node, values: ReadonlySet<SourceStorageBoundSubject> | undefined,
    captures: Set<SourceStorageSubstitutions>): void => {
    budget.withRows(rows => {
      const pending: SourceStorageBoundSubject[] = [];
      const visited = new Map<SourceStorageSubstitutions, Set<SourceStorageSubject>>();
      const schedule = (value: SourceStorageBoundSubject): boolean => {
        const selected = visited.get(value.bindings);
        if (selected?.has(value.subject)) return true;
        if (!rows.add(selected === undefined ? 2 : 1)) return false;
        const retained = selected ?? new Set<SourceStorageSubject>();
        retained.add(value.subject);
        visited.set(value.bindings, retained);
        pending.push(value);
        return true;
      };
      for (const value of values ?? []) if (!budget.step() || !schedule(value)) return;
      while (pending.length !== 0) {
        if (!budget.step()) return;
        const value = pending.pop()!;
        const node = value.subject.node;
        if (value.subject.kind !== "value" || value.subject.projection.length !== 0 ||
          !source.ast.is.IsClassDeclaration(node) && !source.ast.is.IsClassExpression(node)) continue;
        if (node === candidate) { captures.add(value.bindings); continue; }
        const heritage = source.navigation.declaredHeritage(node);
        if (heritage.kind !== "resolved") continue;
        for (const edge of heritage.edges) {
          if (!budget.step()) return;
          if (edge.kind !== "extends") continue;
          const subject = queries.subjectFor(source.ast.as.AsExpressionWithTypeArguments(edge.heritage)?.Expression);
          const inherited = subject === undefined ? undefined : queries.valuesFor(subject, value.bindings);
          for (const selected of inherited ?? []) if (!budget.step() || !schedule(selected)) return;
        }
      }
    });
  };
  const forInvocation = (candidate: Node, invocation: Node, bindings: SourceStorageSubstitutions) => {
    const target = queries.targetFor(invocation);
    const values = target === undefined ? undefined : queries.valuesFor(target, bindings);
    const captures = new Set<SourceStorageSubstitutions>();
    if (source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate))
      instanceCaptures(candidate, values, captures);
    else if (source.ast.is.IsConstructorDeclaration(candidate)) {
      const owner = source.ast.parent(candidate);
      if (owner !== undefined && (source.ast.is.IsClassDeclaration(owner) || source.ast.is.IsClassExpression(owner)))
        instanceCaptures(owner, values, captures);
    } else for (const value of values ?? []) {
      if (!budget.step()) break;
      const selected = source.navigation.callableImplementation(value.subject.node);
      if (selected.kind === "resolved" && selected.implementation.declaration === candidate) captures.add(value.bindings);
    }
    if (target === undefined) captures.add(bindings);
    const states = new Set<SourceStorageSubstitutions>();
    for (const captured of captures) {
      if (!budget.step()) break;
      const selected = queries.bindingsFor(candidate, invocation, bindings, captured);
      if (selected !== undefined) states.add(selected);
    }
    return states;
  };
  return Object.freeze({ forInvocation, hasAllocation });
}
