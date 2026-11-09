import type { Node } from "@tsonic/tsts";
import type { SourceMemoryBoundary, SourceMemoryProducer, SourceMemoryQueries, SourcePointerBackingProducer } from "../source-model/memory.js";
import type { SourceStorageQueries } from "../source-model/program.js";
import type { SourceStorageBindings, SourceStorageSubject } from "../source-model/storage.js";
import type { SourceMemoryEnvironments } from "./source-storage/model/memory-environments.js";
import type { SourceStorageBudget } from "./source-storage/model/resource-budget.js";

export function createSourcePointerBackingQueries(input: {
  readonly storage: SourceStorageQueries;
  readonly environments: SourceMemoryEnvironments;
  readonly budget: SourceStorageBudget;
}): SourceMemoryQueries["pointerBacking"] {
  const { storage, environments, budget } = input;
  const { source } = storage;
  const retained = new WeakMap<SourceStorageSubject, WeakMap<SourceStorageBindings, ReturnType<SourceMemoryQueries["pointerBacking"]["value"]>>>();
  const retainedRows = budget.createRows();
  const unresolved = (reason: string) => Object.freeze({ kind: "unresolved" as const, reason });
  const value: SourceMemoryQueries["pointerBacking"]["value"] = (subject, bindings) => budget.withRows(rows => {
    const owned = storage.typeFor(subject);
    if (owned.kind !== "resolved") return owned;
    const valid = storage.contextKeyFor([subject], bindings);
    if (valid.kind !== "resolved") return valid;
    const previous = retained.get(subject)?.get(bindings);
    if (previous !== undefined) return previous;
    const selected = storage.storageProducersFor(subject, bindings);
    if (selected.kind === "unresolved" || selected.kind === "refused") return selected;
    const producers: SourcePointerBackingProducer[] = [];
    for (const producer of selected.producers) {
      if (!budget.step()) return unresolved(budget.failure()!);
      if (producer.subject.kind !== "value" || producer.subject.projection.length !== 0)
        return unresolved("Pointer backing requires each original complete pointer-producing operation.");
      const operation = source.facts.protocols.pointerOperation(producer.subject.node);
      if (operation.kind === "refused") return operation;
      if (operation.value.kind === "none")
        return unresolved("A pointer storage producer has no canonical original pointer operation.");
      const current = operation.value.value;
      if (!(current.family === "typed-location" && (current.operation === "allocate" || current.operation === "address-of" ||
        current.operation === "bind-pointer" || current.operation === "project-pointer")) &&
        !(current.family === "raw-memory" && current.operation === "reinterpret"))
        return unresolved("Pointer backing requires its original allocation, address, binding, projection or reinterpretation.");
      const typed = environments.typed(producer, producer.bindings);
      if (typed.kind !== "resolved") return typed;
      for (const original of typed.value) {
        if (!budget.step() || !rows.add(2 + original.typeBindings.length)) return unresolved(budget.failure()!);
        const storage: SourceMemoryProducer = Object.freeze({ ...producer, ...original });
        producers.push(Object.freeze({ storage, operation: current }));
      }
    }
    const boundaries: SourceMemoryBoundary[] = [];
    if (selected.kind === "open") for (const boundary of selected.boundaries) {
      if (!budget.step()) return unresolved(budget.failure()!);
      const type = storage.typeFor(boundary.subject);
      if (type.kind !== "resolved") return type;
      const typed = environments.typed({ subject: boundary.subject, type: type.type, sourceFile: type.sourceFile }, boundary.bindings);
      if (typed.kind !== "resolved") return typed;
      for (const original of typed.value) {
        if (!budget.step() || !rows.add(2 + original.typeBindings.length)) return unresolved(budget.failure()!);
        boundaries.push(Object.freeze({ ...boundary, ...original }));
      }
    }
    const result = Object.freeze({ kind: "resolved" as const, value: boundaries.length === 0
      ? Object.freeze({ kind: "complete" as const, producers: Object.freeze(producers), includesAbsence: selected.includesAbsence === true })
      : Object.freeze({ kind: "open" as const, producers: Object.freeze(producers), boundaries: Object.freeze(boundaries),
          includesAbsence: selected.includesAbsence === true }) });
    if (!retainedRows.add(2 + producers.length + boundaries.length)) return unresolved(budget.failure()!);
    let byBindings = retained.get(subject);
    if (byBindings === undefined) { byBindings = new WeakMap(); retained.set(subject, byBindings); }
    byBindings.set(bindings, result);
    return result;
  });
  function returned(declaration: Node, bindings: SourceStorageBindings) {
    source.facts.navigation.callableRoles(declaration);
    const subject = storage.subject(declaration, "return");
    return subject.kind !== "resolved" ? subject : value(subject.subject, bindings);
  }
  return Object.freeze({ value, returned });
}
