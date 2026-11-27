import type { ConstId } from "../ids/contract.js";
import type { BinaryExpression, Expression, NodeHeader } from "../ir-hir/contract.js";
import { shortCircuitOperatorOf } from "../ir-hir/index.js";
import type { TirSelection, TypedPhase } from "../ir-tir/contract.js";
import { rawValueTypeOf as rawType } from "../ir-tir/index.js";
import type { ConditionStep, ConditionTarget, Evaluated, Lowering } from "./model.js";
import { callerDefect, checkDemand, executingValue, failure, notLoweredYet, siteOf } from "./model.js";
import { observePendingRead, popOperand } from "./operands.js";
import { constantOperand, enterBlock, newBlock, terminate } from "./state.js";

export function booleanControl(lowering: Lowering, condition: Evaluated, node: NodeHeader):
  { readonly kind: "known"; readonly value: boolean } | { readonly kind: "dynamic"; readonly constant: ConstId } | null {
  const type = lowering.typeOf(condition.storage);
  if (type.kind === "literal" && type.value.kind === "boolean") return { kind: "known", value: type.value.value };
  if (type.kind !== "primitive" || type.primitive !== "bool") return notLoweredYet("a condition without a selected boolean conversion", node.origin);
  const constant = constantOperand(lowering.state, condition.storage, { kind: "literal", value: { kind: "boolean", value: true } });
  if (constant === null) return null;
  if (condition.operand.kind === "constant" && condition.operand.constant === constant.constant) return { kind: "known", value: true };
  return { kind: "dynamic", constant: constant.constant };
}

export function shortCircuitSelection(node: BinaryExpression<TypedPhase>): Exclude<TirSelection, { readonly kind: "conditional" }> {
  const payload = node.tsonic;
  if (payload.role !== "short-circuit") return callerDefect("a short-circuit expression has another value role", node.origin);
  const selected = payload.selection;
  if (selected.kind === "conditional" || selected.kind !== shortCircuitOperatorOf(node.operatorToken.kind, "short-circuit")
    || selected.control !== node.left.id || selected.right !== node.right.id)
    return callerDefect("a short-circuit selection differs from its actual operands", node.origin);
  return selected;
}

export function logicalCondition(lowering: Lowering, source: Expression<TypedPhase>): BinaryExpression<TypedPhase> | null {
  let node = source;
  while (node.kind === "ParenthesizedExpression") {
    const payload = executingValue(node.tsonic, node.origin);
    if (payload.conversion.kind !== "identity" || payload.narrowing?.kind === "narrowed") return null;
    checkDemand(lowering, payload, node);
    node = node.expression;
  }
  if (node.kind !== "BinaryExpression") return null;
  const payload = node.tsonic;
  if (payload.role !== "short-circuit" || payload.selection.kind === "coalesce"
    || payload.conversion.kind !== "identity" || payload.narrowing?.kind === "narrowed") return null;
  const type = lowering.typeOf(rawType(payload));
  if (type.kind !== "primitive" || type.primitive !== "bool") return null;
  return node;
}

function enterBranch(lowering: Lowering, step: Extract<ConditionStep, { readonly kind: "condition-branch" }>): boolean {
  const node = logicalCondition(lowering, step.node);
  if (node === null) {
    lowering.work.push({ ...step, kind: "condition-leaf" }, { kind: "expression", node: step.node });
    return true;
  }
  const selection = shortCircuitSelection(node);
  const payload = node.tsonic;
  if (payload.role !== "short-circuit" || selection.kind === "coalesce")
    return callerDefect("a native condition requires its actual Boolean selection", node.origin);
  checkDemand(lowering, payload, node);
  const left = { ...step, kind: "condition-branch", node: node.left } as const;
  if (selection.disposition === "left") {
    lowering.work.push(left);
    return true;
  }
  const onTrue = selection.kind === "and";
  const reaches = selection.disposition === "dynamic" ? { node: node.right, block: null } : null;
  lowering.work.push({ kind: "condition-right", node, reaches, selected: onTrue ? "true" : "false", branch: { ...left, node: node.right } });
  if (reaches === null)
    lowering.work.push({ kind: "expression", node: node.left });
  else lowering.work.push({ ...left, whenTrue: onTrue ? reaches : step.whenTrue, whenFalse: onTrue ? step.whenFalse : reaches });
  return true;
}

function branchLeaf(lowering: Lowering, step: Extract<ConditionStep, { readonly kind: "condition-leaf" }>): boolean {
  const { node } = step;
  const value = popOperand(lowering, failure("a native branch was reached without its condition", node.origin));
  const control = booleanControl(lowering, value, node);
  if (control === null) return false;
  const state = lowering.state;
  const target = (outlet: ConditionTarget) => outlet.block ??= newBlock(state, siteOf(lowering.body, outlet.node));
  const site = siteOf(lowering.body, node);
  if (control.kind === "known") {
    if (!observePendingRead(lowering, value)) return false;
    const next = target(control.value ? step.whenTrue : step.whenFalse);
    if (next === null) return false;
    terminate(state, { ...site, kind: "goto", target: next });
    return true;
  }
  const whenTrue = target(step.whenTrue);
  if (whenTrue === null) return false;
  const otherwise = target(step.whenFalse);
  if (otherwise === null) return false;
  terminate(state, { ...site, kind: "switch", operand: value.operand,
    targets: [{ constant: control.constant, target: whenTrue }], otherwise, step: null });
  return true;
}

export function conditionStep(lowering: Lowering, step: ConditionStep): boolean {
  switch (step.kind) {
    case "condition-branch": return enterBranch(lowering, step);
    case "condition-leaf": return branchLeaf(lowering, step);
    case "condition-right": {
      if (step.reaches === null) {
        const value = popOperand(lowering, failure("a selected condition has no left operand", step.node.origin));
        if (!observePendingRead(lowering, value)) return false;
      } else {
        if (step.reaches.block === null) return true;
        enterBlock(lowering.state, step.reaches.block);
      }
      const control = step.node.left;
      const previous = lowering.selections.get(control.id);
      lowering.selections.set(control.id, step.selected);
      lowering.work.push({ kind: "condition-restore", node: control, previous }, step.branch);
      return true;
    }
    case "condition-restore":
      if (step.previous === undefined) lowering.selections.delete(step.node.id);
      else lowering.selections.set(step.node.id, step.previous);
      return true;
  }
}
