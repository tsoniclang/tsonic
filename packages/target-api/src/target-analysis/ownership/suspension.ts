import type { Node, Type } from "@tsonic/tsts";
import type { SourceFinalTypeQueries, TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceOwnershipBudget, SourceOwnershipPremises, SourcePendingOperation, SourcePendingSelection, SourceOwnershipUnresolved, SourceSuspensionSelection } from "./model.js";
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
  type PendingEntry = { readonly selection: SourcePendingSelection; readonly declared: boolean };
  const cache = new Map<Node, Map<SourceStorageBindings, PendingEntry>>();
  type OriginSelection = { readonly kind: "resolved"; readonly contract: Exclude<SourceSuspensionSelection, SourceOwnershipUnresolved>;
    readonly declared: boolean };
  const origins = new Map<SourceStorageSubject, Map<SourceStorageBindings, OriginSelection>>();
  const forOrigin = (value: SourceStorageSubject, bindings: SourceStorageBindings): OriginSelection | SourceOwnershipUnresolved => {
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
    } else if (!sourceOwnershipImmediateType(selectedType.type, source.semantics.forNode(value.node).types, budget)) {
      return sourceOwnershipUnresolved(value.node, budget.failure() ?? "The actual awaited value has no checked possibly-pending or non-suspending contract.");
    }
    if (!rows.add(4)) return sourceOwnershipUnresolved(value.node, budget.failure()!);
    const contract: Exclude<SourceSuspensionSelection, SourceOwnershipUnresolved> = Object.freeze(selected === undefined
      ? { kind: "never", value, contractDeclaration: value.node, checkedType: selectedType.type } : { ...selected });
    const result: OriginSelection = Object.freeze({ kind: "resolved", contract, declared: selected !== undefined });
    const byBinding = origins.get(value) ?? new Map<SourceStorageBindings, OriginSelection>();
    byBinding.set(bindings, result);
    origins.set(value, byBinding);
    return result;
  };
  const select = (operation: Node, expression: Node, bindings: SourceStorageBindings,
    requireContract: boolean): SourcePendingSelection => {
    if (!budget.step()) return sourceOwnershipUnresolved(operation, budget.failure()!);
    const existing = cache.get(operation)?.get(bindings);
    const missingContract = () => sourceOwnershipUnresolved(expression,
      "A no-body invocation requires its checked native continuation contract; a non-async result is not an empty-work proof.");
    if (existing !== undefined) return requireContract && !existing.declared ? missingContract() : existing.selection;
    const types = source.semantics.forNode(expression).types;
    const expressionType = types.expressionType(expression);
    if (!requireContract && expressionType !== undefined && sourceOwnershipImmediateType(expressionType, types, budget)) {
      if (!rows.add(2)) return sourceOwnershipUnresolved(operation, budget.failure()!);
      const selection: SourcePendingSelection = Object.freeze({ kind: "never" });
      const values = cache.get(operation) ?? new Map<SourceStorageBindings, PendingEntry>();
      values.set(bindings, Object.freeze({ selection, declared: false }));
      cache.set(operation, values);
      return selection;
    }
    const subject = storage.subjectFor(expression);
    if (subject.kind === "unresolved") return sourceOwnershipUnresolved(operation, subject.reason);
    const bound = storage.storageProducersFor(subject.subject, bindings);
    if (bound.kind === "unresolved") return sourceOwnershipUnresolved(operation, bound.reason);
    if (bound.producers.length === 0) return sourceOwnershipUnresolved(expression, "An operation requires a complete nonempty bound-origin selection.");
    const contracts: SourcePendingOperation["contracts"][number][] = [];
    let declared = true;
    for (const actual of bound.producers) {
      const selection = forOrigin(actual.subject, actual.bindings);
      if (selection.kind === "unresolved") return selection;
      declared &&= selection.declared;
      if (requireContract && !selection.declared) return missingContract();
      if (selection.contract.kind === "may-suspend") contracts.push(selection.contract);
    }
    if (!rows.add(2 + contracts.length)) return sourceOwnershipUnresolved(operation, budget.failure()!);
    const result: SourcePendingSelection = contracts.length === 0 ? Object.freeze({ kind: "never" })
      : Object.freeze({ kind: "resolved", pending: Object.freeze({ operation, expression, bindings,
        contracts: Object.freeze(contracts) }) });
    const byBinding = cache.get(operation) ?? new Map<SourceStorageBindings, PendingEntry>();
    byBinding.set(bindings, Object.freeze({ selection: result, declared }));
    cache.set(operation, byBinding);
    return result;
  };
  return Object.freeze({
    owns(pending: SourcePendingOperation): boolean {
      if (!budget.step()) return false;
      const selected = cache.get(pending.operation)?.get(pending.bindings);
      return selected?.selection.kind === "resolved" && selected.selection.pending === pending;
    },
    forAwait(operation: Node, bindings: SourceStorageBindings): SourcePendingSelection {
      if (!budget.step()) return sourceOwnershipUnresolved(operation, budget.failure()!);
      const existing = cache.get(operation)?.get(bindings);
      if (existing !== undefined) return existing.selection;
      const file = source.ast.getSourceFile(operation);
      const expression = source.ast.is.IsAwaitExpression(operation)
        ? source.ast.as.AsAwaitExpression(operation)?.Expression : undefined;
      if (file === undefined || !source.semantics.includes(file) || expression === undefined) {
        return sourceOwnershipUnresolved(operation, "A pending operation requires its exact checked await and operand.");
      }
      return select(operation, expression, bindings, false);
    },
    forCall(call: Node, bindings: SourceStorageBindings): SourcePendingSelection {
      if (!budget.step()) return sourceOwnershipUnresolved(call, budget.failure()!);
      const file = source.ast.getSourceFile(call);
      if (file === undefined || !source.semantics.includes(file) ||
        !source.ast.is.IsCallExpression(call) && !source.ast.is.IsNewExpression(call)) {
        return sourceOwnershipUnresolved(call, "A native completion requires its exact checked source call.");
      }
      const selected = source.semantics.forNode(call).operations.call(call);
      if (selected?.sourceSelectedSignatureKind !== "resolved") {
        return sourceOwnershipUnresolved(call, "A native completion requires its checked selected signature.");
      }
      return select(call, call, bindings, true);
    },
    forResult(expression: Node, bindings: SourceStorageBindings): SourcePendingSelection {
      if (!budget.step()) return sourceOwnershipUnresolved(expression, budget.failure()!);
      const file = source.ast.getSourceFile(expression);
      if (file === undefined || !source.semantics.includes(file)) {
        return sourceOwnershipUnresolved(expression, "A completion result requires its exact checked source expression.");
      }
      return select(expression, expression, bindings, false);
    },
  });
}

export function sourceOwnershipImmediateType(type: Type, types: SourceFinalTypeQueries, budget: SourceOwnershipBudget): boolean {
  if (!budget.step() || types.isAny(type) || types.isUnknown(type) || types.isIntersection(type)) return false;
  if (types.isUnion(type)) {
    const members = types.unionOrIntersectionTypes(type);
    return members.length > 0 && members.every(member => sourceOwnershipImmediateType(member, types, budget));
  }
  return types.isNever(type) || types.isNumberLike(type) || types.isBooleanLike(type) || types.isStringLike(type) ||
    types.isBigIntLike(type) || types.isSymbolLike(type) || types.isNullish(type) || types.isVoidLike(type);
}

export type SourceSuspensionQueries = ReturnType<typeof createSourceSuspensionQuery>;
