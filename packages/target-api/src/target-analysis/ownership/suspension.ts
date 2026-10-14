import type { Node, Type } from "@tsonic/tsts";
import type { SourceFinalTypeQueries, TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceOwnershipBudget, SourceOwnershipPremises, SourcePendingOperation, SourcePendingSelection,
  SourceSuspensionSelection } from "./model.js";
import { sourceOwnershipContractProblem, sourceOwnershipUnresolved } from "./contracts.js";

export function createSourceSuspensionQuery(input: {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly premises: Pick<SourceOwnershipPremises, "suspensionFor">;
  readonly budget: SourceOwnershipBudget;
}) {
  const { source, storage, premises, budget } = input;
  if (source !== storage.source) throw new Error("Suspension and storage must share the identical checked source program.");
  const rows = budget.createRows();
  const cache = new Map<Node, Map<SourceStorageBindings, SourcePendingSelection>>();
  const origins = new Map<SourceStorageSubject, Map<SourceStorageBindings, SourceSuspensionSelection>>();
  const forOrigin = (value: SourceStorageSubject, bindings: SourceStorageBindings): SourceSuspensionSelection => {
    if (!budget.step()) return sourceOwnershipUnresolved(value.node, budget.failure()!);
    const existing = origins.get(value)?.get(bindings);
    if (existing !== undefined) return existing;
    const selectedType = storage.typeFor(value);
    if (selectedType.kind === "unresolved") return sourceOwnershipUnresolved(value.node, selectedType.reason);
    const selected = premises.suspensionFor(value, bindings);
    if (selected?.kind === "unresolved") return selected;
    if (selected !== undefined) {
      if (selected.value !== value) {
        return sourceOwnershipUnresolved(value.node, "Suspension evidence belongs to a different actual bound operand.");
      }
      const problem = sourceOwnershipContractProblem(source, value.node, selectedType.type, selected);
      if (problem !== undefined) return sourceOwnershipUnresolved(value.node, problem);
    } else if (!immediateType(selectedType.type, source.semantics.forNode(value.node).types, budget)) {
      return sourceOwnershipUnresolved(value.node, budget.failure() ?? "The actual awaited value has no checked possibly-pending or non-suspending contract.");
    }
    if (!rows.add(3)) return sourceOwnershipUnresolved(value.node, budget.failure()!);
    const result: SourceSuspensionSelection = Object.freeze(selected === undefined
      ? { kind: "never", value, contractDeclaration: value.node, checkedType: selectedType.type } : { ...selected });
    const byBinding = origins.get(value) ?? new Map<SourceStorageBindings, SourceSuspensionSelection>();
    byBinding.set(bindings, result);
    origins.set(value, byBinding);
    return result;
  };
  return Object.freeze({
    owns(pending: SourcePendingOperation): boolean {
      if (!budget.step()) return false;
      const selected = cache.get(pending.operation)?.get(pending.bindings);
      return selected?.kind === "resolved" && selected.pending === pending;
    },
    forAwait(operation: Node, bindings: SourceStorageBindings): SourcePendingSelection {
      if (!budget.step()) return sourceOwnershipUnresolved(operation, budget.failure()!);
      const existing = cache.get(operation)?.get(bindings);
      if (existing !== undefined) return existing;
      const file = source.ast.getSourceFile(operation);
      const expression = source.ast.is.IsAwaitExpression(operation)
        ? source.ast.as.AsAwaitExpression(operation)?.Expression : undefined;
      if (file === undefined || !source.semantics.includes(file) || expression === undefined) {
        return sourceOwnershipUnresolved(operation, "A pending operation requires its exact checked await and operand.");
      }
      const subject = storage.subjectFor(expression);
      if (subject.kind === "unresolved") return sourceOwnershipUnresolved(operation, subject.reason);
      const bound = storage.boundOriginsFor(subject.subject, bindings);
      if (bound.kind === "unresolved") return sourceOwnershipUnresolved(operation, bound.reason);
      if (bound.subjects.length === 0) return sourceOwnershipUnresolved(expression, "An await requires a complete nonempty bound-origin selection.");
      const contracts: SourcePendingOperation["contracts"][number][] = [];
      for (const actual of bound.subjects) {
        const selection = forOrigin(actual, bindings);
        if (selection.kind === "unresolved") return selection;
        if (selection.kind === "may-suspend") contracts.push(selection);
      }
      if (!rows.add(2 + contracts.length)) return sourceOwnershipUnresolved(operation, budget.failure()!);
      const result: SourcePendingSelection = contracts.length === 0 ? Object.freeze({ kind: "never" })
        : Object.freeze({ kind: "resolved", pending: Object.freeze({ operation, expression, bindings,
          contracts: Object.freeze(contracts) }) });
      const byBinding = cache.get(operation) ?? new Map<SourceStorageBindings, SourcePendingSelection>();
      byBinding.set(bindings, result);
      cache.set(operation, byBinding);
      return result;
    },
  });
}

function immediateType(type: Type, types: SourceFinalTypeQueries, budget: SourceOwnershipBudget): boolean {
  if (!budget.step() || types.isAny(type) || types.isUnknown(type) || types.isIntersection(type)) return false;
  if (types.isUnion(type)) {
    const members = types.unionOrIntersectionTypes(type);
    return members.length > 0 && members.every(member => immediateType(member, types, budget));
  }
  return types.isNever(type) || types.isNumberLike(type) || types.isBooleanLike(type) || types.isStringLike(type) ||
    types.isBigIntLike(type) || types.isSymbolLike(type) || types.isNullish(type) || types.isVoidLike(type);
}

export type SourceSuspensionQueries = ReturnType<typeof createSourceSuspensionQuery>;
