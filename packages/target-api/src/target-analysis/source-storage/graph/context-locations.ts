import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageStore } from "./stored-values.js";

export type SourceStorageContextLocation = "allocation" | "binding";

export function createSourceStorageContextLocations(source: TargetSourceProgram, budget: SourceStorageBudget,
  storesFor: (subject: SourceStorageSubject) => Iterable<SourceStorageStore> | undefined,
  hasResultAlias: (subject: SourceStorageSubject) => boolean) {
  return (subject: SourceStorageSubject): SourceStorageContextLocation | undefined => {
    if (subject.kind === "value" && (source.ast.is.IsObjectLiteralExpression(subject.node) ||
      source.ast.is.IsArrayLiteralExpression(subject.node) || source.ast.is.IsNewExpression(subject.node) && !hasResultAlias(subject))) return "allocation";
    for (const store of storesFor(subject) ?? []) {
      if (!budget.step()) return undefined;
      if (store.destination === "binding" && store.kind === "mutation") return "binding";
    }
    return undefined;
  };
}
