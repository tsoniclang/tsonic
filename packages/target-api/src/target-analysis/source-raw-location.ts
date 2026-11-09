import type { Node } from "@tsonic/tsts";
import type { SourcePresence, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceMemoryQueries, SourceMemoryRawLocation, SourceMemorySelection } from "../source-model/memory.js";
import type { SourceStorageBindings } from "../source-model/storage.js";
import type { SourceMemoryContext } from "./source-memory-context.js";
import type { SourceMemoryEnvironments } from "./source-storage/model/memory-environments.js";
import type { SourceStorageBudget } from "./source-storage/model/resource-budget.js";

export function createSourceRawLocationQueries(input: {
  readonly context: SourceMemoryContext;
  readonly environments: SourceMemoryEnvironments;
  readonly metadata: SourceMemoryQueries["memoryMetadata"];
  readonly budget: SourceStorageBudget;
}): SourceMemoryQueries["rawLocation"] {
  const { context, environments, metadata, budget } = input;
  const { source, view } = context;
  const retained = new WeakMap<Node, WeakMap<SourceStorageBindings, SourceMemoryRawLocation>>();
  const retainedRows = budget.createRows();
  const none = Object.freeze({ kind: "none" } as const);
  const resolved = <Value>(value: Value): SourceMemorySelection<Value> => Object.freeze({ kind: "resolved", value });
  const unresolved = (reason: string) => Object.freeze({ kind: "unresolved" as const, reason });
  function pointerDomain(value: SourceTypeEvidence, pointee: SourceTypeEvidence): SourceMemorySelection<boolean> {
    return budget.withRows(rows => {
      view.assertEvidence(value);
      view.assertEvidence(pointee);
      if (!rows.add(1)) return unresolved(budget.failure()!);
      const pending = [value];
      while (pending.length !== 0) {
        if (!budget.step()) return unresolved(budget.failure()!);
        const current = pending.pop()!;
        view.assertEvidence(current);
        if (current.sum !== undefined) {
          if (current.sum.arms.length === 0) return resolved(false);
          if (!rows.add(current.sum.arms.length)) return unresolved(budget.failure()!);
          for (const arm of current.sum.arms) pending.push(arm);
          continue;
        }
        if (current.type.kind === "intrinsic" && current.type.intrinsic === "absence") continue;
        if (current.type.kind === "optional") {
          const child = view.component(current, { kind: "optional-value" });
          if (child.kind === "refused") return child;
          if (!rows.add(1)) return unresolved(budget.failure()!);
          pending.push(child.value);
          continue;
        }
        const pointer = source.facts.protocols.pointerType(current);
        if (pointer.kind === "refused") return pointer;
        if (pointer.value.kind === "none" || pointer.value.value.kind !== "typed-location") return resolved(false);
        const selected = context.equivalent(pointer.value.value.pointee, pointee);
        if (selected.kind !== "resolved" || !selected.value) return selected;
      }
      return resolved(true);
    });
  }
  const resolve: SourceMemoryQueries["rawLocation"]["resolve"] = (occurrence, bindings) => budget.withRows(rows => {
    context.assertNode(occurrence);
    const original = source.facts.protocols.pointerOperation(occurrence);
    if (original.kind === "refused") return original;
    if (original.value.kind === "none" || original.value.value.family !== "raw-memory" ||
      original.value.value.operation !== "to-raw" && original.value.value.operation !== "reinterpret") return resolved(none);
    const operation = original.value.value;
    const activations = environments.environments(occurrence, bindings);
    if (activations.kind !== "resolved") return activations;
    if (activations.value.length !== 1)
      return unresolved("A raw memory operation requires its one complete correlated activation environment.");
    const application = source.facts.applications.application(occurrence);
    if (application.kind === "refused") return application;
    if (application.value.identity.invocation !== occurrence || application.value.argumentDisposition === "skip")
      return unresolved("A raw memory location requires its exact original executed Source application.");
    const operands = operation.operation === "to-raw" ? [operation.pointer, operation.layout] : [operation.raw, operation.layout];
    if (application.value.sourceArguments.length !== operands.length || application.value.sourceArguments.some((argument, index) =>
      argument.form !== "value" || argument.occurrence !== operands[index]!.occurrence))
      throw new Error("A raw memory operation retains its complete original Source argument vector.");
    const environment = context.environment(activations.value[0]!,
      [...application.value.identity.classBindings, ...application.value.identity.signatureBindings]);
    if (environment.kind !== "resolved") return environment;
    const previous = retained.get(occurrence)?.get(bindings);
    if (previous !== undefined) return resolved(Object.freeze({ kind: "present", value: previous }));
    if (!budget.step() || !rows.add(2 + environment.value.length)) return unresolved(budget.failure()!);
    const pointee = context.substitute(operation.pointee, environment.value);
    if (pointee.kind !== "resolved") return pointee;
    const selected = metadata.value(operation.layout.occurrence, bindings);
    if (selected.kind !== "resolved") return selected;
    if (selected.value.kind === "none" || selected.value.value.kind !== "memory-layout")
      return unresolved("A raw memory location requires its original finalized scoped memory layout.");
    const layout = selected.value.value.layout;
    const domain = context.equivalent(pointee.value, layout.source);
    if (domain.kind !== "resolved") return domain;
    if (!domain.value)
      return unresolved("A raw memory location requires the same complete applied Source pointee and layout domain.");
    if (operation.operation === "to-raw") {
      const pointer = context.substitute(operation.pointer.value, environment.value);
      if (pointer.kind !== "resolved") return pointer;
      const domain = pointerDomain(pointer.value, pointee.value);
      if (domain.kind !== "resolved") return domain;
      if (!domain.value)
        return unresolved("Every present raw conversion pointer arm must retain its exact applied Source pointee domain.");
    }
    const result: SourceMemoryRawLocation = Object.freeze({ operation, pointee: pointee.value, layout,
      bindings, typeBindings: environment.value });
    if (!retainedRows.add(2 + result.typeBindings.length)) return unresolved(budget.failure()!);
    let byBindings = retained.get(occurrence);
    if (byBindings === undefined) { byBindings = new WeakMap(); retained.set(occurrence, byBindings); }
    byBindings.set(bindings, result);
    const present: SourcePresence<SourceMemoryRawLocation> = Object.freeze({ kind: "present", value: result });
    return resolved(present);
  });
  return Object.freeze({ resolve });
}
