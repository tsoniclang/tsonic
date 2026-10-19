import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageObjectRestOwner } from "../model/subjects.js";
import type { SourceStorageStore } from "./stored-values.js";
import type { SourceStorageCallEffect } from "../model/types.js";

export type SourceStorageContextLocation = "allocation" | "binding";

export function createSourceStorageContextLocations(source: TargetSourceProgram, budget: SourceStorageBudget,
  storesFor: (subject: SourceStorageSubject) => Iterable<SourceStorageStore> | undefined,
  callEffectFor: (subject: SourceStorageSubject) => SourceStorageCallEffect | undefined) {
  return (subject: SourceStorageSubject): SourceStorageContextLocation | undefined => {
    if (subject.kind === "value") {
      const effect = callEffectFor(subject);
      if (source.ast.is.IsObjectLiteralExpression(subject.node) || source.ast.is.IsArrayLiteralExpression(subject.node) ||
        sourceStorageObjectRestOwner(subject.node, source.ast) !== undefined ||
        source.ast.is.IsNewExpression(subject.node) && effect?.resultAlias === undefined ||
        effect?.resultAllocation === subject.node) return "allocation";
    }
    for (const store of storesFor(subject) ?? []) {
      if (!budget.step()) return undefined;
      if (store.destination === "binding" && store.kind === "mutation") return "binding";
    }
    return undefined;
  };
}
