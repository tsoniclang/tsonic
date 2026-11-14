import type { BlockId, ConstId } from "../ids/contract.js";
import type { BreakStatement, ContinueStatement, DoStatement, ForStatement, IfStatement, LabeledStatement, NodeHeader, WhileStatement } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { ControlScope, Evaluated, LoopContinuation, Lowering, Work } from "./model.js";
import { callerDefect, failure, notLoweredYet, siteOf } from "./model.js";
import { popOperand } from "./operands.js";
import { constantOperand, enterBlock, newBlock, terminate } from "./state.js";

function booleanControl(lowering: Lowering, condition: Evaluated, node: NodeHeader):
  { readonly kind: "known"; readonly value: boolean } | { readonly kind: "dynamic"; readonly constant: ConstId } | null {
  const type = lowering.typeOf(condition.storage);
  if (type.kind === "literal" && type.value.kind === "boolean") return { kind: "known", value: type.value.value };
  if (type.kind !== "primitive" || type.primitive !== "bool") return notLoweredYet("a condition without a selected boolean conversion", node.origin);
  const constant = constantOperand(lowering.state, condition.storage, { kind: "literal", value: { kind: "boolean", value: true } });
  if (constant === null) return null;
  if (condition.operand.kind === "constant" && condition.operand.constant === constant.constant) return { kind: "known", value: true };
  return { kind: "dynamic", constant: constant.constant };
}

export function enterIf(lowering: Lowering, node: IfStatement<TypedPhase>): boolean {
  const condition = popOperand(lowering, failure("an if completed without its condition", node.origin));
  const control = booleanControl(lowering, condition, node.expression);
  if (control === null) return false;
  if (control.kind === "known") {
    const selected = control.value ? node.thenStatement : node.elseStatement;
    if (selected !== null) lowering.work.push({ kind: "statement", node: selected });
    return true;
  }
  const then = newBlock(lowering.state, siteOf(lowering.body, node.thenStatement));
  if (then === null) return false;
  const otherwise = newBlock(lowering.state, siteOf(lowering.body, node.elseStatement ?? node));
  if (otherwise === null) return false;
  terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "switch", operand: condition.operand,
    targets: [{ constant: control.constant, target: then }], otherwise, step: null });
  enterBlock(lowering.state, then);
  lowering.work.push({ kind: "if-then-end", node, otherwise, exit: node.elseStatement === null ? otherwise : null },
    { kind: "statement", node: node.thenStatement });
  return true;
}

export function endThen(lowering: Lowering, pending: Extract<Work, { readonly kind: "if-then-end" }>): boolean {
  let exit = pending.exit;
  if (lowering.state.current !== null) {
    if (exit === null) exit = newBlock(lowering.state, siteOf(lowering.body, pending.node));
    if (exit === null) return false;
    terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target: exit });
  }
  enterBlock(lowering.state, pending.otherwise);
  if (pending.node.elseStatement !== null) lowering.work.push({ kind: "if-else-end", node: pending.node, exit },
    { kind: "statement", node: pending.node.elseStatement });
  return true;
}

export function endElse(lowering: Lowering, pending: Extract<Work, { readonly kind: "if-else-end" }>): boolean {
  let exit = pending.exit;
  if (lowering.state.current !== null) {
    if (exit === null) exit = newBlock(lowering.state, siteOf(lowering.body, pending.node));
    if (exit === null) return false;
    terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target: exit });
  }
  if (exit !== null) enterBlock(lowering.state, exit);
  return true;
}

export function breaks(lowering: Lowering, node: BreakStatement<TypedPhase>): boolean {
  const target = node.tsonic.target;
  if (target.body !== lowering.body.body) return callerDefect("a break targets another body", node.origin);
  const scope = lowering.labels.get(target.node);
  if (scope === undefined) return callerDefect("a break has no active selected target", node.origin);
  if (scope.exit === null) {
    const exit = newBlock(lowering.state, siteOf(lowering.body, scope.node));
    if (exit === null) return false;
    scope.exit = exit;
  }
  terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "goto", target: scope.exit });
  return true;
}

export function endLabel(lowering: Lowering, node: LabeledStatement<TypedPhase>, scope: Extract<ControlScope, { readonly kind: "label" }>): boolean {
  if (scope.exit !== null) {
    if (lowering.state.current !== null) terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "goto", target: scope.exit });
    enterBlock(lowering.state, scope.exit);
  }
  lowering.labels.delete(node.tsonic.target.node);
  return true;
}

export function continues(lowering: Lowering, node: ContinueStatement<TypedPhase>): boolean {
  const target = node.tsonic.target;
  if (target.body !== lowering.body.body) return callerDefect("a continue targets another body", node.origin);
  const scope = lowering.labels.get(target.node);
  if (scope === undefined || scope.continuation === null) return callerDefect("a continue has no active loop target", node.origin);
  const next = continuationTarget(lowering, scope.continuation);
  if (next === null) return false;
  terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "goto", target: next });
  return true;
}

export function enterFor(lowering: Lowering, node: ForStatement<TypedPhase>): boolean {
  const { state, body } = lowering;
  const head = newBlock(state, siteOf(body, node.statement));
  if (head === null) return false;
  terminate(state, { ...siteOf(body, node), kind: "goto", target: head });
  enterBlock(state, head);
  const continuation: LoopContinuation = { head, update: node.incrementor === null ? null : { expression: node.incrementor, block: null } };
  const { scope, previous } = placeLoop(lowering, node, continuation);
  if (node.condition === null) lowering.work.push({ kind: "for-end", node, scope, previous }, { kind: "statement", node: node.statement });
  else lowering.work.push({ kind: "for-condition", node, scope, previous }, { kind: "expression", node: node.condition });
  return true;
}

function placeLoop(lowering: Lowering, node: ForStatement<TypedPhase> | WhileStatement<TypedPhase> | DoStatement<TypedPhase>, continuation: LoopContinuation):
  { readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined } {
  let child: NodeHeader = node;
  for (let position = lowering.work.length - 1; position >= 0; position -= 1) {
    const pending = lowering.work[position];
    if (pending?.kind !== "label-end" || pending.node.statement !== child) break;
    pending.scope.continuation = continuation;
    child = pending.node;
  }
  const previous = lowering.labels.get(node.id);
  const scope: Extract<ControlScope, { readonly kind: "loop" }> = { kind: "loop", node, exit: null, continuation };
  lowering.labels.set(node.id, scope);
  return { scope, previous };
}

export function endFor(lowering: Lowering, pending: Extract<Work, { readonly kind: "for-end" }>): boolean {
  const { node, scope } = pending;
  if (lowering.state.current !== null) {
    const target = continuationTarget(lowering, scope.continuation);
    if (target === null) return false;
    terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "goto", target });
  }
  const update = scope.continuation.update;
  if (update === null || update.block === null) return closeLoop(lowering, pending);
  enterBlock(lowering.state, update.block);
  const incrementor = update.expression;
  lowering.work.push({ ...pending, kind: "for-next" }, { kind: "discard", node: incrementor }, { kind: "expression", node: incrementor });
  return true;
}

function continuationTarget(lowering: Lowering, continuation: LoopContinuation): BlockId | null {
  if (continuation.update === null) return continuation.head;
  if (continuation.update.block === null) continuation.update.block = newBlock(lowering.state, siteOf(lowering.body, continuation.update.expression));
  return continuation.update.block;
}

export function nextFor(lowering: Lowering, pending: Extract<Work, { readonly kind: "for-next" }>): boolean {
  terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target: pending.scope.continuation.head });
  return closeLoop(lowering, pending);
}

function closeLoop(lowering: Lowering, pending: Extract<Work, { readonly kind: "for-condition" | "for-end" | "for-next" | "while-condition" | "while-end" | "do-end" | "do-condition" }>): boolean {
  const { node, scope, previous } = pending;
  if (previous === undefined) lowering.labels.delete(node.id);
  else lowering.labels.set(node.id, previous);
  if (scope.exit !== null) enterBlock(lowering.state, scope.exit);
  return true;
}

export function enterWhile(lowering: Lowering, node: WhileStatement<TypedPhase>): boolean {
  const head = newBlock(lowering.state, siteOf(lowering.body, node.expression));
  if (head === null) return false;
  terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "goto", target: head });
  enterBlock(lowering.state, head);
  const { scope, previous } = placeLoop(lowering, node, { head, update: null });
  lowering.work.push({ kind: "while-condition", node, scope, previous }, { kind: "expression", node: node.expression });
  return true;
}

export function loopCondition(lowering: Lowering, pending: Extract<Work, { readonly kind: "for-condition" | "while-condition" | "do-condition" }>): boolean {
  const condition = popOperand(lowering, failure("a loop completed without its condition", pending.node.origin));
  const control = booleanControl(lowering, condition, pending.node);
  if (control === null) return false;
  if (control.kind === "known" && !control.value) {
    if (pending.scope.exit !== null) terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target: pending.scope.exit });
    return closeLoop(lowering, pending);
  }
  const body = pending.kind === "do-condition" ? pending.scope.continuation.head : newBlock(lowering.state, siteOf(lowering.body, pending.node.statement));
  if (body === null) return false;
  if (control.kind === "dynamic") {
    const exit = pending.scope.exit ?? newBlock(lowering.state, siteOf(lowering.body, pending.node));
    if (exit === null) return false;
    pending.scope.exit = exit;
    terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "switch", operand: condition.operand,
      targets: [{ constant: control.constant, target: body }], otherwise: exit, step: null });
  } else terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target: body });
  if (pending.kind === "do-condition") return closeLoop(lowering, pending);
  enterBlock(lowering.state, body);
  if (pending.kind === "for-condition") lowering.work.push({ ...pending, kind: "for-end" }, { kind: "statement", node: pending.node.statement });
  else lowering.work.push({ ...pending, kind: "while-end" }, { kind: "statement", node: pending.node.statement });
  return true;
}

export function endWhile(lowering: Lowering, pending: Extract<Work, { readonly kind: "while-end" }>): boolean {
  if (lowering.state.current !== null) terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target: pending.scope.continuation.head });
  return closeLoop(lowering, pending);
}

export function enterDo(lowering: Lowering, node: DoStatement<TypedPhase>): boolean {
  const head = newBlock(lowering.state, siteOf(lowering.body, node.statement));
  if (head === null) return false;
  terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "goto", target: head });
  enterBlock(lowering.state, head);
  const condition: NonNullable<LoopContinuation["update"]> = { expression: node.expression, block: null };
  const { scope, previous } = placeLoop(lowering, node, { head, update: condition });
  lowering.work.push({ kind: "do-end", node, scope, previous, condition }, { kind: "statement", node: node.statement });
  return true;
}

export function endDo(lowering: Lowering, pending: Extract<Work, { readonly kind: "do-end" }>): boolean {
  if (lowering.state.current !== null) {
    const target = continuationTarget(lowering, pending.scope.continuation);
    if (target === null) return false;
    terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target });
  }
  const update = pending.condition;
  if (update.block === null) return closeLoop(lowering, pending);
  enterBlock(lowering.state, update.block);
  lowering.work.push({ kind: "do-condition", node: pending.node, scope: pending.scope, previous: pending.previous },
    { kind: "expression", node: pending.node.expression });
  return true;
}
