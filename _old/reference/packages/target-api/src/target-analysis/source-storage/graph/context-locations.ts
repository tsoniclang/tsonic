import type { SourceStorageProgram } from "../model/program.js";

import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../../../source-model/storage.js";
import { sourceStorageObjectRestOwner } from "../model/subjects.js";
import type { SourceStorageStore } from "../model/stores.js";
import type { SourceStorageCallEffect } from "../../../source-model/storage.js";

export type SourceStorageContextLocation = "allocation" | "binding";

export function createSourceStorageContextLocations(source: SourceStorageProgram, budget: SourceStorageBudget,
  storesFor: (subject: SourceStorageSubject) => Iterable<SourceStorageStore> | undefined,
  callEffectFor: (subject: SourceStorageSubject) => SourceStorageCallEffect | undefined) {
  return (subject: SourceStorageSubject): SourceStorageContextLocation | undefined => {
    if (subject.kind === "value") {
      const effect = callEffectFor(subject);
      if (source.ast.is.IsObjectLiteralExpression(subject.node) || source.ast.is.IsArrayLiteralExpression(subject.node) ||
        sourceStorageObjectRestOwner(subject.node, source.ast) !== undefined ||
        source.ast.is.IsNewExpression(subject.node) && effect?.kind !== "result-alias" ||
        effect?.kind === "result-allocation" && effect.allocation === subject.node) return "allocation";
    }
    for (const store of storesFor(subject) ?? []) {
      if (!budget.step()) return undefined;
      if (store.destination === "binding" && store.kind === "mutation") return "binding";
    }
    return undefined;
  };
}
