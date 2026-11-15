import type { BlockId, ConstId, PlaceId } from "../ids/contract.js";
import type { BinaryExpression, BreakStatement, ConditionalExpression, ContinueStatement, DoStatement, ForStatement, IfStatement, LabeledStatement, NodeHeader, WhileStatement } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { ControlScope, Evaluated, LoopContinuation, Lowering, Work } from "./model.js";
import { callerDefect, failure, notLoweredYet, rawType, siteOf } from "./model.js";
import { held, popOperand, pushOperand, temporary } from "./operands.js";
import { leaveLocalScopes } from "./bindings.js";
import { constantOperand, emitStatement, enterBlock, newBlock, terminate } from "./state.js";

export function enterConditional(lowering: Lowering, node: ConditionalExpression<TypedPhase>): boolean {
  const condition = popOperand(lowering, failure("a conditional completed without its control", node.origin));
  const selected = node.tsonic.selection;
  if (selected.kind !== "conditional") return callerDefect("a conditional has another selection kind", node.origin);
  const control = booleanControl(lowering, condition, node.condition);
  if (control === null) return false;
  if (selected.disposition !== "dynamic") return selectArm(lowering, node, selected.disposition === "true");
  if (control.kind === "known") return selectArm(lowering, node, control.value);
  const head = lowering.state.current;
  if (head === null) return callerDefect("a conditional has no executing split", node.origin);
  const site = siteOf(lowering.body, node);
  const result = temporary(lowering, rawType(node.tsonic), site);
  if (result === null) return false;
  const first = newBlock(lowering.state, siteOf(lowering.body, node.whenTrue));
  if (first === null) return false;
  const otherwise = newBlock(lowering.state, siteOf(lowering.body, node.whenFalse));
  if (otherwise === null) return false;
  const exit = newBlock(lowering.state, site);
  if (exit === null) return false;
  lowering.branches.push({ block: head.id, prefix: lowering.operands.length });
  terminate(lowering.state, { ...site, kind: "switch", operand: condition.operand, targets: [{ constant: control.constant, target: first }], otherwise, step: null });
  enterBlock(lowering.state, first);
  lowering.selections.set(node.condition.id, "true");
  lowering.work.push({ kind: "conditional-true", node, place: result, otherwise, exit }, { kind: "expression", node: node.whenTrue });
  return true;
}

function selectArm(lowering: Lowering, node: ConditionalExpression<TypedPhase>, taken: boolean): boolean {
  lowering.selections.set(node.condition.id, taken ? "true" : "false");
  lowering.work.push({ kind: "selected-end", node }, { kind: "expression", node: taken ? node.whenTrue : node.whenFalse });
  return true;
}

function assignSelected(lowering: Lowering, node: ConditionalExpression<TypedPhase> | BinaryExpression<TypedPhase>, place: PlaceId, value: Evaluated): boolean {
  if (value.storage !== rawType(node.tsonic)) return callerDefect("a selected arm differs from its actual result storage", node.origin);
  return emitStatement(lowering.state, { ...siteOf(lowering.body, node), kind: "assign", place, value: { kind: "use", operand: value.operand }, step: null });
}

function selectedResult(lowering: Lowering, node: ConditionalExpression<TypedPhase> | BinaryExpression<TypedPhase>, place: PlaceId): boolean {
  const value = popOperand(lowering, failure("a selected arm completed without its value", node.origin));
  return assignSelected(lowering, node, place, value);
}

export function endSelected(lowering: Lowering, node: ConditionalExpression<TypedPhase> | BinaryExpression<TypedPhase>): boolean {
  const value = popOperand(lowering, failure("a selected arm completed without its value", node.origin));
  if (value.storage !== rawType(node.tsonic)) return callerDefect("a selected arm differs from its actual result storage", node.origin);
  pushOperand(lowering, value);
  lowering.selections.delete(node.kind === "ConditionalExpression" ? node.condition.id : node.left.id);
  return true;
}

export function enterShortCircuit(lowering: Lowering, node: BinaryExpression<TypedPhase>): boolean {
  const left = popOperand(lowering, failure("a short-circuit expression completed without its control", node.origin));
  const payload = node.tsonic;
  if (payload.role !== "short-circuit" || payload.selection.kind === "conditional")
    return callerDefect("a short-circuit expression has another selection kind", node.origin);
  const selected = payload.selection;
  const when = selected.kind === "and" ? "true" : selected.kind === "or" ? "false" : "absent";
  if (selected.disposition === "right") return selectRight(lowering, node, when);
  if (selected.disposition === "left") return keepLeft(lowering, node, left);
  let constant: ConstId;
  let rightOnMatch: boolean;
  if (selected.kind === "coalesce") {
    const type = lowering.typeOf(left.storage);
    if (type.kind === "intrinsic" && type.intrinsic === "absence") return selectRight(lowering, node, when);
    if (type.kind !== "optional") return notLoweredYet("a coalescing selector without its selected absence carrier", node.origin);
    const absence = constantOperand(lowering.state, left.storage, { kind: "literal", value: { kind: "absence" } });
    if (absence === null) return false;
    constant = absence.constant;
    rightOnMatch = true;
  } else {
    const control = booleanControl(lowering, left, node.left);
    if (control === null) return false;
    if (control.kind === "known") return control.value === (selected.kind === "and")
      ? selectRight(lowering, node, when) : keepLeft(lowering, node, left);
    constant = control.constant;
    rightOnMatch = selected.kind === "and";
  }
  const head = lowering.state.current;
  if (head === null) return callerDefect("a short-circuit expression has no executing split", node.origin);
  if (left.storage !== rawType(payload)) return notLoweredYet("a selected result storage embedding", node.origin);
  const site = siteOf(lowering.body, node);
  const result = temporary(lowering, rawType(payload), site);
  if (result === null) return false;
  const retained = newBlock(lowering.state, siteOf(lowering.body, node.left));
  if (retained === null) return false;
  const right = newBlock(lowering.state, siteOf(lowering.body, node.right));
  if (right === null) return false;
  const exit = newBlock(lowering.state, site);
  if (exit === null) return false;
  lowering.branches.push({ block: head.id, prefix: lowering.operands.length });
  terminate(lowering.state, { ...site, kind: "switch", operand: left.operand,
    targets: [{ constant, target: rightOnMatch ? right : retained }], otherwise: rightOnMatch ? retained : right, step: null });
  enterBlock(lowering.state, retained);
  if (!assignSelected(lowering, node, result, left)) return false;
  terminate(lowering.state, { ...site, kind: "goto", target: exit });
  enterBlock(lowering.state, right);
  lowering.selections.set(node.left.id, when);
  lowering.work.push({ kind: "short-circuit-end", node, place: result, exit }, { kind: "expression", node: node.right });
  return true;
}

function selectRight(lowering: Lowering, node: BinaryExpression<TypedPhase>, when: "true" | "false" | "absent"): boolean {
  lowering.selections.set(node.left.id, when);
  lowering.work.push({ kind: "selected-end", node }, { kind: "expression", node: node.right });
  return true;
}

function keepLeft(lowering: Lowering, node: BinaryExpression<TypedPhase>, left: Evaluated): boolean {
  if (left.storage !== rawType(node.tsonic)) return notLoweredYet("a selected result storage embedding", node.origin);
  pushOperand(lowering, left);
  return true;
}

export function endShortCircuit(lowering: Lowering, pending: Extract<Work, { readonly kind: "short-circuit-end" }>): boolean {
  if (!selectedResult(lowering, pending.node, pending.place)) return false;
  terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target: pending.exit });
  lowering.branches.pop();
  lowering.selections.delete(pending.node.left.id);
  enterBlock(lowering.state, pending.exit);
  pushOperand(lowering, held(pending.place, rawType(pending.node.tsonic), siteOf(lowering.body, pending.node)));
  return true;
}

export function endConditionalTrue(lowering: Lowering, pending: Extract<Work, { readonly kind: "conditional-true" }>): boolean {
  if (!selectedResult(lowering, pending.node, pending.place)) return false;
  terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target: pending.exit });
  enterBlock(lowering.state, pending.otherwise);
  lowering.selections.set(pending.node.condition.id, "false");
  lowering.work.push({ kind: "conditional-false", node: pending.node, place: pending.place, exit: pending.exit },
    { kind: "expression", node: pending.node.whenFalse });
  return true;
}

export function endConditionalFalse(lowering: Lowering, pending: Extract<Work, { readonly kind: "conditional-false" }>): boolean {
  if (!selectedResult(lowering, pending.node, pending.place)) return false;
  terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target: pending.exit });
  lowering.branches.pop();
  lowering.selections.delete(pending.node.condition.id);
  enterBlock(lowering.state, pending.exit);
  pushOperand(lowering, held(pending.place, rawType(pending.node.tsonic), siteOf(lowering.body, pending.node)));
  return true;
}

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
  if (!leaveLocalScopes(lowering, scope.locals, node)) return false;
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
  if (!leaveLocalScopes(lowering, scope.locals, node)) return false;
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
  const scope: Extract<ControlScope, { readonly kind: "loop" }> = { kind: "loop", node, exit: null, continuation, locals: lowering.scope };
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
