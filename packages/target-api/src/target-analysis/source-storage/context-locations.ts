import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";
import type { SourceStorageStore } from "./stored-values.js";

export function createSourceStorageContextLocations(source: TargetSourceProgram, budget: SourceStorageBudget,
  storesFor: (subject: SourceStorageSubject) => Iterable<SourceStorageStore> | undefined,
  hasResultAlias: (subject: SourceStorageSubject) => boolean) {
  return (subject: SourceStorageSubject): boolean => {
    if (subject.kind === "value" && (source.ast.is.IsObjectLiteralExpression(subject.node) ||
      source.ast.is.IsArrayLiteralExpression(subject.node) || source.ast.is.IsNewExpression(subject.node) && !hasResultAlias(subject))) return true;
    for (const store of storesFor(subject) ?? []) {
      if (!budget.step()) return false;
      if (store.destination === "binding" && store.kind === "mutation") return true;
    }
    return false;
  };
}
