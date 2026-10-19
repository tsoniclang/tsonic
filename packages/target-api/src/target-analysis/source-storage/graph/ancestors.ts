import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageIncomingQuery } from "./edges.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { createSourceStorageGraphQueries } from "./graph-queries.js";
import { sourceStorageHasOriginalValue } from "../model/subjects.js";

export function createSourceStorageOriginQuery(source: TargetSourceProgram, budget: SourceStorageBudget,
  incoming: SourceStorageIncomingQuery, graph: ReturnType<typeof createSourceStorageGraphQueries>) {
  const { ast } = source;
  return graph.closure<SourceStorageSubject, SourceStorageSubject>((origin, emit, follow) => {
    if (!budget.step()) return false;
    const inputs = incoming(origin);
    if ((ast.is.IsParameterDeclaration(origin.node) || ast.is.IsObjectLiteralExpression(origin.node) ||
      ast.is.IsNewExpression(origin.node) || sourceStorageHasOriginalValue(origin, ast, inputs.size !== 0)) && !emit(origin)) return false;
    for (const input of inputs) if (!follow(input)) return false;
    return budget.failure() === undefined;
  });
}

export function createSourceStorageAncestorQuery(budget: SourceStorageBudget, incoming: SourceStorageIncomingQuery) {
  return function* (selected: SourceStorageSubject,
    accepts?: (subject: SourceStorageSubject, origins: ReadonlySet<SourceStorageSubject>) => boolean): IterableIterator<SourceStorageSubject> {
    const rows = budget.createRows();
    const visited = new Set<SourceStorageSubject>();
    const pending: SourceStorageSubject[] = [];
    const admit = (subject: SourceStorageSubject): boolean => {
      if (visited.has(subject)) return true;
      if (!rows.add(2)) return false;
      visited.add(subject);
      pending.push(subject);
      return true;
    };
    try {
      if (!admit(selected)) return;
      for (let index = 0; index < pending.length; index += 1) {
        if (!budget.step()) return;
        const current = pending[index]!;
        const origins = incoming(current);
        if (accepts === undefined || accepts(current, origins)) yield current;
        for (const origin of origins) {
          if (!budget.step() || !admit(origin)) return;
        }
      }
    } finally {
      visited.clear();
      pending.length = 0;
      rows.release();
    }
  };
}
