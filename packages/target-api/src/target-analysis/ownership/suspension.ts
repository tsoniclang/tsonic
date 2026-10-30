import type { Node, Type } from "@tsonic/tsts";
import { Node_Expression } from "../../source-navigation/index.js";
import type { SourceFinalTypeQueries, TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceOwnershipBudget, SourceOwnershipPremises, SourcePendingOperation, SourcePendingSelection, SourceOwnershipUnresolved, SourceSuspensionSelection } from "./model.js";
import { sourceOwnershipContractProblem, sourceOwnershipUnresolved } from "./contracts.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises, SourceDeclarationOwnershipValues,
  SourceDeclarationPendingOperation, SourceDeclarationPendingSelection } from "./model.js";
import { sourceDeclarationOwnershipContractProblem, sourceDeclarationOwnershipUnresolved } from "./contracts.js";

export function createSourceSuspensionQuery(input: {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly premises: Pick<SourceOwnershipPremises, "suspensionFor">;
  readonly budget: SourceOwnershipBudget;
}) {
  const { source, storage, premises, budget } = input;
  if (source !== storage.source) throw new Error("Suspension and storage must share the identical checked source program.");
  const rows = budget.createRows();
  type PendingEntry = { readonly value?: SourcePendingSelection; readonly invocation?: SourcePendingSelection };
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
    const mode = requireContract ? "invocation" : "value";
    const existing = cache.get(operation)?.get(bindings)?.[mode];
    const missingContract = () => sourceOwnershipUnresolved(expression,
      "A no-body invocation requires its checked native continuation contract; a non-async result is not an empty-work proof.");
    if (existing !== undefined) return existing;
    const publish = (selection: SourcePendingSelection): void => {
      const values = cache.get(operation) ?? new Map<SourceStorageBindings, PendingEntry>();
      values.set(bindings, Object.freeze({ ...values.get(bindings), [mode]: selection }));
      cache.set(operation, values);
    };
    const types = source.semantics.forNode(expression).types;
    const expressionType = types.expressionType(expression);
    if (!requireContract && expressionType !== undefined && sourceOwnershipImmediateType(expressionType, types, budget)) {
      if (!rows.add(2)) return sourceOwnershipUnresolved(operation, budget.failure()!);
      const selection: SourcePendingSelection = Object.freeze({ kind: "never" });
      publish(selection);
      return selection;
    }
    const subject = storage.subjectFor(expression);
    if (subject.kind === "unresolved") return sourceOwnershipUnresolved(operation, subject.reason);
    const contracts: SourcePendingOperation["contracts"][number][] = [];
    if (requireContract) {
      const context = storage.contextKeyFor([], bindings);
      if (context.kind === "unresolved") return sourceOwnershipUnresolved(operation, context.reason);
      const selection = forOrigin(subject.subject, bindings);
      if (selection.kind === "unresolved") return selection;
      if (!selection.declared) return missingContract();
      if (selection.contract.kind === "may-suspend") contracts.push(selection.contract);
    } else {
      const bound = storage.storageProducersFor(subject.subject, bindings);
      if (bound.kind === "unresolved") return sourceOwnershipUnresolved(operation, bound.reason);
      if (bound.producers.length === 0) return sourceOwnershipUnresolved(expression, "An operation requires a complete nonempty bound-origin selection.");
      for (const actual of bound.producers) {
        const selection = forOrigin(actual.subject, actual.bindings);
        if (selection.kind === "unresolved") return selection;
        if (selection.contract.kind === "may-suspend") contracts.push(selection.contract);
      }
    }
    if (!rows.add(2 + contracts.length)) return sourceOwnershipUnresolved(operation, budget.failure()!);
    const result: SourcePendingSelection = contracts.length === 0 ? Object.freeze({ kind: "never" })
      : Object.freeze({ kind: "resolved", pending: Object.freeze({ operation, expression, bindings,
        contracts: Object.freeze(contracts) }) });
    publish(result);
    return result;
  };
  return Object.freeze({
    owns(pending: SourcePendingOperation): boolean {
      if (!budget.step()) return false;
      const selected = cache.get(pending.operation)?.get(pending.bindings);
      return selected?.value?.kind === "resolved" && selected.value.pending === pending ||
        selected?.invocation?.kind === "resolved" && selected.invocation.pending === pending;
    },
    forAwait(operation: Node, bindings: SourceStorageBindings): SourcePendingSelection {
      if (!budget.step()) return sourceOwnershipUnresolved(operation, budget.failure()!);
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

export function createSourceDeclarationSuspensionQuery(input: {
  readonly source: TargetSourceProgram;
  readonly values: SourceDeclarationOwnershipValues;
  readonly premises: Pick<SourceDeclarationOwnershipPremises, "suspensionFor">;
  readonly budget: SourceDeclarationOwnershipBudget;
}) {
  const { source, values, premises, budget } = input;
  const cache = new Map<Node, SourceDeclarationPendingSelection>();
  const pending = new WeakSet<SourceDeclarationPendingOperation>();
  const select = (operation: Node, expression: Node): SourceDeclarationPendingSelection => {
    if (!budget.step(operation)) return budget.failure()!;
    const existing = cache.get(operation);
    if (existing !== undefined) return existing;
    const region = values.regionFor(operation);
    if ("kind" in region) return region;
    const value = values.forNode(expression);
    if ("kind" in value) return value;
    if (value.region !== region)
      return sourceDeclarationOwnershipUnresolved(operation, "A native pending operand must belong to this exact checked execution region.");
    const selected = premises.suspensionFor(value);
    if (selected === undefined)
      return sourceDeclarationOwnershipUnresolved(expression,
        "A missing declaration body or native completion record is not proof of a non-suspending operation.");
    if (selected.kind === "unresolved") return selected;
    if (selected.value !== value)
      return sourceDeclarationOwnershipUnresolved(expression, "Native suspension evidence belongs to a different checked local operand.");
    const problem = sourceDeclarationOwnershipContractProblem(source, expression, value.component, selected.contract);
    if (problem !== undefined) return sourceDeclarationOwnershipUnresolved(expression, problem);
    const rows = budget.createRows(operation);
    if (!rows.add(selected.kind === "never" ? 2 : 4)) { rows.release(); return budget.failure()!; }
    if (selected.kind === "never") {
      const result = Object.freeze({ kind: "never" as const });
      cache.set(operation, result);
      return result;
    }
    const witness: SourceDeclarationPendingOperation = Object.freeze({ operation, expression, region,
      contracts: Object.freeze([Object.freeze({ value, contract: selected.contract })]) });
    pending.add(witness);
    const result = Object.freeze({ kind: "resolved" as const, pending: witness });
    cache.set(operation, result);
    return result;
  };
  return Object.freeze({
    owns: (witness: SourceDeclarationPendingOperation): boolean => pending.has(witness),
    forAwait(operation: Node): SourceDeclarationPendingSelection {
      if (!budget.step(operation)) return budget.failure()!;
      const file = source.ast.getSourceFile(operation);
      const expression = source.ast.is.IsAwaitExpression(operation)
        ? Node_Expression(source.ast, operation) : undefined;
      if (file === undefined || !source.semantics.includes(file) || expression === undefined)
        return sourceDeclarationOwnershipUnresolved(operation, "A pending await requires its original checked operation and operand.");
      return select(operation, expression);
    },
    forCall(call: Node): SourceDeclarationPendingSelection {
      if (!budget.step(call)) return budget.failure()!;
      const file = source.ast.getSourceFile(call);
      if (file === undefined || !source.semantics.includes(file) ||
        !source.ast.is.IsCallExpression(call) && !source.ast.is.IsNewExpression(call))
        return sourceDeclarationOwnershipUnresolved(call, "Native completion requires its exact checked call operation.");
      const selected = source.semantics.forNode(call).operations.call(call);
      if (selected?.sourceSelectedSignatureKind !== "resolved")
        return sourceDeclarationOwnershipUnresolved(call, "Native completion requires its checked selected declaration contract.");
      return select(call, call);
    },
    forResult(expression: Node): SourceDeclarationPendingSelection { return select(expression, expression); },
  });
}

export type SourceDeclarationSuspensionQueries = ReturnType<typeof createSourceDeclarationSuspensionQuery>;
