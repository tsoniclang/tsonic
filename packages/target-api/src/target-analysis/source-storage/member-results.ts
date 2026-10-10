import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { sourceStorageMemberSubject } from "./subjects.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageBoundSubject, SourceStorageSubstitutions } from "./substitutions.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { createSourceStorageMemberFlow } from "./member-flow.js";

interface SourceStorageMemberResultQueries {
  readonly subject: SourceStorageSubjectQuery;
  readonly memberFlow: ReturnType<typeof createSourceStorageMemberFlow>;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  valuesFor(subject: SourceStorageSubject, bindings: SourceStorageSubstitutions): ReadonlySet<SourceStorageBoundSubject> | undefined;
  implementationsFor(invocation: Node): ReadonlySet<Node>;
  bindingsFor(candidate: Node, invocation: Node, bindings: SourceStorageSubstitutions): ReadonlySet<SourceStorageSubstitutions>;
}

export function createSourceStorageMemberResults(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  queries: SourceStorageMemberResultQueries,
) {
  const select = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions): readonly SourceStorageBoundSubject[] | undefined => budget.withRows(rows => {
    const { ast, semantics } = source;
    if (subject.kind !== "value" || !ast.is.IsPropertyAccessExpression(subject.node) && !ast.is.IsElementAccessExpression(subject.node)) return undefined;
    const property = ast.is.IsPropertyAccessExpression(subject.node) ? semantics.forNode(subject.node).operations.propertyAccess(subject.node) : undefined;
    const selected = property ?? semantics.forNode(subject.node).operations.elementAccess(subject.node);
    const declaration = property?.selectedReadDeclaration ?? selected?.selectedDeclaration;
    if (selected === undefined || declaration === undefined || ast.is.IsGetAccessorDeclaration(declaration)) return undefined;
    const receiver = queries.subjectFor(selected.receiver.expression);
    if (receiver === undefined) {
      budget.reject("Source storage member reads require their exact checked receiver occurrence.");
      return undefined;
    }
    const values = queries.valuesFor(receiver, bindings);
    if (values === undefined) return undefined;
    const results: SourceStorageBoundSubject[] = [];
    for (const value of values) {
      if (!budget.step()) return undefined;
      const originals = queries.memberFlow.declarationsFor(value.subject, declaration, selected.receiver.type);
      if (originals === undefined) {
        budget.reject("Source storage member reads require exact checked source-to-destination correspondence.");
        return undefined;
      }
      const contexts = new Set<SourceStorageSubstitutions>();
      if (ast.is.IsNewExpression(value.subject.node)) {
        for (const candidate of queries.implementationsFor(value.subject.node)) {
          if (!budget.step()) return undefined;
          for (const context of queries.bindingsFor(candidate, value.subject.node, value.bindings)) {
            if (!budget.step()) return undefined;
            if (!contexts.has(context) && !rows.add(1)) return undefined;
            contexts.add(context);
          }
        }
      }
      if (contexts.size === 0) {
        if (!rows.add(1)) return undefined;
        contexts.add(value.bindings);
      }
      for (const original of originals) {
        if (!budget.step()) return undefined;
        const member = sourceStorageMemberSubject(original, ast, queries.subject, subject.projection);
        if (member === undefined) return undefined;
        for (const context of contexts) {
          if (!budget.step() || !rows.add(1)) return undefined;
          results.push(Object.freeze({ subject: member, bindings: context }));
        }
      }
    }
    return Object.freeze(results);
  });
  return Object.freeze({ select });
}
