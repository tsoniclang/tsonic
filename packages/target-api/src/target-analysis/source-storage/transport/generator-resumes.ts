import { sourceStorageInvocationReceiver, sourceStorageIsGenerator } from "../model/host-reads.js";
import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageCallEffect } from "../model/types.js";
import type { SourceStorageSubject } from "../model/subjects.js";

export function createSourceStorageGeneratorResumes(source: SourceAnalysisProgram, budget: SourceStorageBudget,
  queries: {
    readonly invocationEffects: ReadonlyMap<Node, SourceStorageCallEffect>;
    subjectFor(node: Node): SourceStorageSubject | undefined;
    originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
    implementationsFor(invocation: Node): ReadonlySet<Node> | undefined;
  }) {
  return (invocation: Node): ReadonlySet<Node> | undefined => budget.withRows(rows => {
    const result = new Set<Node>();
    if (queries.invocationEffects.get(invocation)?.resumeReceiver !== true) return result;
    const receiver = sourceStorageInvocationReceiver(source, invocation);
    const selected = receiver === undefined ? undefined : queries.subjectFor(receiver);
    const origins = selected === undefined ? undefined : queries.originsFor(selected);
    if (origins === undefined) return undefined;
    for (const origin of origins) {
      if (!budget.step()) return undefined;
      if (origin.kind !== "value" || origin.projection.length !== 0 || !source.ast.is.IsCallExpression(origin.node)) continue;
      const implementations = queries.implementationsFor(origin.node);
      if (implementations === undefined) return undefined;
      for (const candidate of implementations) {
        if (!budget.step()) return undefined;
        if (!sourceStorageIsGenerator(source, candidate) || result.has(candidate)) continue;
        if (!rows.add(1)) return undefined;
        result.add(candidate);
      }
    }
    return result;
  });
}
