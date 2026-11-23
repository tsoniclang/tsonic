import type { BlockId, ConstId, PlaceId, TyId } from "../ids/contract.js";
import type { CaseClause, DefaultClause } from "../ir-hir/contract.js";
import type { BinaryExpression, BreakStatement, ConditionalExpression, ContinueStatement, DoStatement, ForStatement, IfStatement, LabeledStatement, NodeHeader, SwitchStatement, WhileStatement } from "../ir-hir/contract.js";
import type { MirOperand, MirStatement } from "../ir-mir/contract.js";
import type { TypedOperation, TypedPhase, TypedValue } from "../ir-tir/contract.js";
import { rawValueTypeOf as rawType } from "../ir-tir/index.js";
import type { ConditionalDestination, ControlScope, Discard, Evaluated, LoopContinuation, Lowering, SwitchDispatch, SwitchTarget, Work } from "./model.js";
import { callerDefect, executingValue, failure, notLoweredYet, siteOf } from "./model.js";
import { held, observePendingRead, popOperand, pushOperand, readPlace, saveRead, temporary } from "./operands.js";
import { leaveLocalScopes, prepareCaseLocals } from "./bindings.js";
import { constantOperand, emitBeforeTerminator, emitStatement, enterBlock, newBlock, terminate } from "./state.js";

export function enterConditional(lowering: Lowering, node: ConditionalExpression<TypedPhase>): boolean {
  const condition = popOperand(lowering, failure("a conditional completed without its control", node.origin));
  const selected = node.tsonic.selection;
  if (selected.kind !== "conditional") return callerDefect("a conditional has another selection kind", node.origin);
  const control = booleanControl(lowering, condition, node.condition);
  if (control === null) return false;
  if (selected.disposition !== "dynamic") return selectArm(lowering, node, condition, selected.disposition === "true");
  if (control.kind === "known") return selectArm(lowering, node, condition, control.value);
  const head = lowering.state.current;
  if (head === null) return callerDefect("a conditional has no executing split", node.origin);
  const site = siteOf(lowering.body, node);
  const discard = discardOf(lowering);
  const storage = rawType(node.tsonic);
  let destination: ConditionalDestination;
  if (discard === null) {
    const place = temporary(lowering, storage, site);
    if (place === null) return false;
    destination = { kind: "value", place };
  } else {
    destination = discard.read?.storage === storage ? discard
      : { ...discard, read: { block: head.id, site, storage, place: null } };
  }
  const first = newBlock(lowering.state, siteOf(lowering.body, node.whenTrue));
  if (first === null) return false;
  const otherwise = newBlock(lowering.state, siteOf(lowering.body, node.whenFalse));
  if (otherwise === null) return false;
  const exit = newBlock(lowering.state, site);
  if (exit === null) return false;
  const switchSite = discard !== null && condition.pendingRead ? condition.site : site;
  terminate(lowering.state, { ...switchSite, kind: "switch", operand: condition.operand, targets: [{ constant: control.constant, target: first }], otherwise, step: null });
  enterBlock(lowering.state, first);
  if (discard !== null) lowering.work.pop();
  return scheduleConditional(lowering, { kind: "conditional-true", node, destination, otherwise, exit }, true,
    destination.kind === "discard" ? destination : null);
}

function discardOf(lowering: Lowering): Discard | null {
  const consumer = lowering.work.at(-1);
  return consumer?.kind === "discard" ? consumer : null;
}

function selectArm(lowering: Lowering, node: ConditionalExpression<TypedPhase>, condition: Evaluated, taken: boolean): boolean {
  const discard = discardOf(lowering);
  if (!observePendingRead(lowering, condition, discard?.read ?? null)) return false;
  if (discard !== null) lowering.work.pop();
  return scheduleConditional(lowering, { kind: "selected-end", node, discarded: discard !== null }, taken, discard);
}

type ConditionalWork = Extract<Work, { readonly kind: "conditional-true" | "conditional-false" }>
  | { readonly kind: "selected-end"; readonly node: ConditionalExpression<TypedPhase>; readonly discarded: boolean };

function scheduleConditional(lowering: Lowering, work: ConditionalWork, taken: boolean, discard: Discard | null): boolean {
  const { node } = work;
  lowering.selections.set(node.condition.id, taken ? "true" : "false");
  lowering.work.push(work);
  if (discard !== null) lowering.work.push(discard);
  lowering.work.push({ kind: "expression", node: taken ? node.whenTrue : node.whenFalse });
  return true;
}

function assignSelected(lowering: Lowering, node: ConditionalExpression<TypedPhase> | BinaryExpression<TypedPhase>, place: PlaceId,
  value: Evaluated, before: BlockId | null = null): boolean {
  if (value.storage !== rawType(node.tsonic)) return callerDefect("a selected arm differs from its actual result storage", node.origin);
  const site = value.pendingRead ? value.site : siteOf(lowering.body, node);
  const statement: MirStatement = { ...site, kind: "assign", place, value: { kind: "use", operand: value.operand }, step: null };
  return before === null ? emitStatement(lowering.state, statement) : emitBeforeTerminator(lowering.state, before, statement);
}

function selectedResult(lowering: Lowering, node: ConditionalExpression<TypedPhase> | BinaryExpression<TypedPhase>, place: PlaceId): boolean {
  const value = popOperand(lowering, failure("a selected arm completed without its value", node.origin));
  return assignSelected(lowering, node, place, value);
}

export function endSelected(lowering: Lowering, { node, discarded }: Extract<Work, { readonly kind: "selected-end" }>): boolean {
  if (!discarded) {
    const value = popOperand(lowering, failure("a selected arm completed without its value", node.origin));
    if (value.storage !== rawType(node.tsonic)) return callerDefect("a selected arm differs from its actual result storage", node.origin);
    pushOperand(lowering, value);
  }
  lowering.selections.delete(node.kind === "ConditionalExpression" ? node.condition.id : node.left.id);
  return true;
}

type SelectedStore = Extract<Work, { readonly kind: "store" }>;

export function enterShortCircuit(lowering: Lowering, node: BinaryExpression<TypedPhase>, store: SelectedStore | null): boolean {
  const left = popOperand(lowering, failure("a short-circuit expression completed without its control", node.origin));
  const payload = node.tsonic;
  const selected = payload.role === "short-circuit" || payload.role === "assignment" ? payload.selection : null;
  if (selected === null || selected.kind === "conditional" || (payload.role === "assignment") !== (store !== null))
    return callerDefect("a short-circuit expression has another selection kind", node.origin);
  const when = selected.kind === "and" ? "true" : selected.kind === "or" ? "false" : "absent";
  const discard = discardOf(lowering);
  const takeRight = () => observePendingRead(lowering, left, discard?.read ?? null)
    && scheduleRight(lowering, node, when, { kind: "selected-end", node, discarded: discard !== null }, store, discard);
  if (selected.disposition === "right") return takeRight();
  if (selected.disposition === "left") return keepLeft(lowering, node, left);
  let constant: ConstId;
  let rightOnMatch: boolean;
  if (selected.kind === "coalesce") {
    const type = lowering.typeOf(left.storage);
    if (type.kind === "intrinsic" && type.intrinsic === "absence")
      return takeRight();
    if (type.kind !== "optional") return notLoweredYet("a coalescing selector without its selected absence carrier", node.origin);
    const absence = constantOperand(lowering.state, left.storage, { kind: "literal", value: { kind: "absence" } });
    if (absence === null) return false;
    constant = absence.constant;
    rightOnMatch = true;
  } else {
    const control = booleanControl(lowering, left, node.left);
    if (control === null) return false;
    if (control.kind === "known") return control.value === (selected.kind === "and")
      ? takeRight() : keepLeft(lowering, node, left);
    constant = control.constant;
    rightOnMatch = selected.kind === "and";
  }
  const head = lowering.state.current;
  if (head === null) return callerDefect("a short-circuit expression has no executing split", node.origin);
  if (left.storage !== rawType(payload)) return notLoweredYet("a selected result storage embedding", node.origin);
  const site = siteOf(lowering.body, node);
  const place = discard === null ? temporary(lowering, rawType(payload), site) : null;
  if (discard === null && place === null) return false;
  const guard = place !== null && left.pendingRead ? { block: head.id, value: left } : null;
  const separateForward = place !== null && guard === null;
  const forward = separateForward ? newBlock(lowering.state, siteOf(lowering.body, node.left)) : null;
  if (separateForward && forward === null) return false;
  const right = newBlock(lowering.state, siteOf(lowering.body, node.right));
  if (right === null) return false;
  const exit = newBlock(lowering.state, site);
  if (exit === null) return false;
  const retained = forward ?? exit;
  const operand: MirOperand = place !== null && guard !== null ? { kind: "place", place } : left.operand;
  const switchSite = discard !== null && left.pendingRead ? left.site : site;
  terminate(lowering.state, { ...switchSite, kind: "switch", operand,
    targets: [{ constant, target: rightOnMatch ? right : retained }], otherwise: rightOnMatch ? retained : right, step: null });
  if (forward !== null && place !== null) {
    enterBlock(lowering.state, forward);
    if (!assignSelected(lowering, node, place, left)) return false;
    terminate(lowering.state, { ...site, kind: "goto", target: exit });
  }
  enterBlock(lowering.state, right);
  const result = place === null ? null : { place, guard };
  return scheduleRight(lowering, node, when, { kind: "short-circuit-end", node, exit, result }, store, discard);
}

function scheduleRight(lowering: Lowering, node: BinaryExpression<TypedPhase>, when: "true" | "false" | "absent",
  end: Extract<Work, { readonly kind: "selected-end" | "short-circuit-end" }>, store: SelectedStore | null, discard: Discard | null): boolean {
  lowering.selections.set(node.left.id, when);
  if (discard !== null) lowering.work.pop();
  lowering.work.push(end);
  if (discard !== null) lowering.work.push(discard);
  if (store !== null) lowering.work.push(store);
  lowering.work.push({ kind: "expression", node: node.right });
  return true;
}

function keepLeft(lowering: Lowering, node: BinaryExpression<TypedPhase>, left: Evaluated): boolean {
  if (left.storage !== rawType(node.tsonic)) return notLoweredYet("a selected result storage embedding", node.origin);
  pushOperand(lowering, left);
  return true;
}

export function endShortCircuit(lowering: Lowering, pending: Extract<Work, { readonly kind: "short-circuit-end" }>): boolean {
  const { result } = pending;
  if (result !== null) {
    if (!selectedResult(lowering, pending.node, result.place)) return false;
    if (result.guard !== null && !assignSelected(lowering, pending.node, result.place, result.guard.value, result.guard.block))
      return false;
  }
  terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target: pending.exit });
  lowering.selections.delete(pending.node.left.id);
  enterBlock(lowering.state, pending.exit);
  if (result !== null) pushOperand(lowering, held(result.place, rawType(pending.node.tsonic), siteOf(lowering.body, pending.node)));
  return true;
}

export function endConditionalTrue(lowering: Lowering, pending: Extract<Work, { readonly kind: "conditional-true" }>): boolean {
  const { node, destination, otherwise, exit } = pending;
  if (destination.kind === "value" && !selectedResult(lowering, node, destination.place)) return false;
  terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "goto", target: exit });
  enterBlock(lowering.state, otherwise);
  return scheduleConditional(lowering, { kind: "conditional-false", node, destination, exit }, false,
    destination.kind === "discard" ? destination : null);
}

export function endConditionalFalse(lowering: Lowering, pending: Extract<Work, { readonly kind: "conditional-false" }>): boolean {
  const { destination } = pending;
  if (destination.kind === "value" && !selectedResult(lowering, pending.node, destination.place)) return false;
  terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target: pending.exit });
  lowering.selections.delete(pending.node.condition.id);
  enterBlock(lowering.state, pending.exit);
  if (destination.kind === "value")
    pushOperand(lowering, held(destination.place, rawType(pending.node.tsonic), siteOf(lowering.body, pending.node)));
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
    if (!observePendingRead(lowering, condition)) return false;
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

export function enterSwitch(lowering: Lowering, node: SwitchStatement<TypedPhase>): boolean {
  const subject = popOperand(lowering, failure("a switch completed without its subject", node.origin));
  const clauses = node.caseBlock.clauses.nodes;
  let first: SwitchTarget<CaseClause<TypedPhase>> | null = null;
  let ordered: SwitchTarget<CaseClause<TypedPhase>> | null = null;
  let whenTrue: SwitchTarget<CaseClause<TypedPhase>> | null = null;
  let whenFalse: SwitchTarget<CaseClause<TypedPhase>> | null = null;
  let fallback: SwitchTarget<DefaultClause<TypedPhase>> | null = null;
  for (const [position, clause] of clauses.entries()) {
    if (clause === undefined) return callerDefect("a switch clause list has a hole", node.origin);
    if (clause.kind === "DefaultClause") {
      if (fallback !== null) return callerDefect("a switch has more than one default clause", clause.origin);
      fallback = { node: clause, position };
      continue;
    }
    if (ordered !== null) continue;
    const literal = fastBooleanLabel(lowering, clause, subject);
    if (literal === null) ordered = first ?? { node: clause, position };
    else {
      const target = literal ? (whenTrue ??= { node: clause, position }) : (whenFalse ??= { node: clause, position });
      first ??= target;
    }
  }
  const hasTests = ordered === null && first !== null;
  const control = hasTests ? booleanControl(lowering, subject, node.expression) : null;
  if (hasTests && control === null) return false;
  const saved = ordered === null ? subject : switchSubject(lowering, subject);
  if (saved === null) return false;
  const site = siteOf(lowering.body, node);
  const enclosing = lowering.scope;
  if (!prepareCaseLocals(lowering, node.caseBlock)) return false;
  const scope: Extract<ControlScope, { readonly kind: "switch" }> = { kind: "switch", node, exit: null, continuation: null, locals: lowering.scope };
  const dispatch: SwitchDispatch = { node, scope, enclosing, entries: new Map() };
  lowering.labels.set(node.id, scope);
  lowering.work.push({ kind: "switch-clause", ...dispatch, position: 0 });
  if (ordered !== null)
    return scheduleSwitchTest(lowering, { kind: "switch-test", ...ordered, dispatch, subject: saved, fallback });
  const otherwise = switchTarget(lowering, dispatch, (control?.kind === "known" && control.value ? whenTrue : whenFalse) ?? fallback);
  if (otherwise === null) return false;
  const match = control?.kind === "dynamic" ? switchTarget(lowering, dispatch, whenTrue ?? fallback) : otherwise;
  if (match === null) return false;
  terminate(lowering.state, { ...site, kind: "switch", operand: subject.operand,
    targets: control?.kind === "dynamic" && match !== otherwise ? [{ constant: control.constant, target: match }] : [], otherwise, step: null });
  return true;
}

function switchTarget(lowering: Lowering, dispatch: SwitchDispatch, target: SwitchTarget | null): BlockId | null {
  const { node, scope, entries } = dispatch;
  if (target === null) {
    scope.exit ??= newBlock(lowering.state, siteOf(lowering.body, node));
    return scope.exit;
  }
  const block = newBlock(lowering.state, siteOf(lowering.body, target.node));
  if (block !== null) entries.set(target.position, block);
  return block;
}

function switchEquality(clause: CaseClause<TypedPhase>, subject: Evaluated): TypedOperation {
  const outcome = clause.tsonic.operation;
  if (outcome.kind !== "decided" || outcome.decision.decision.operands[0] !== subject.storage)
    return callerDefect("a case has no selected equality of its actual subject", clause.origin);
  return outcome.decision;
}

function fastBooleanLabel(lowering: Lowering, clause: CaseClause<TypedPhase>, subject: Evaluated): boolean | null {
  const { decision } = switchEquality(clause, subject);
  if (decision.operation.kind !== "boolean-operator" || decision.operation.operator !== "===" || decision.execution.kind !== "pure") return null;
  let test = clause.expression;
  let parentType: TyId | null = null;
  while (test.kind === "ParenthesizedExpression" || test.kind === "AsExpression"
    || test.kind === "TypeAssertionExpression" || test.kind === "SatisfiesExpression") {
    const value = executingValue(test.tsonic, test.origin);
    if (!transparentCaseValue(value)) return null;
    if (parentType !== null && parentType !== value.type)
      return callerDefect("a Boolean switch case without matching selected literal evidence", test.origin);
    parentType = value.type;
    test = test.expression;
  }
  if (test.kind !== "TrueKeyword" && test.kind !== "FalseKeyword") return null;
  const selected = test.tsonic;
  if (selected.role !== "value")
    return callerDefect("a Boolean switch case without matching selected literal evidence", test.origin);
  if (!transparentCaseValue(selected)) return null;
  if (decision.operands[1] !== selected.type || parentType !== null && parentType !== selected.type)
    return callerDefect("a Boolean switch case without matching selected literal evidence", test.origin);
  const expected = test.kind === "TrueKeyword";
  const type = lowering.typeOf(selected.type);
  const carrier = type.kind === "literal" && type.value.kind === "boolean" && type.value.value === expected
    ? lowering.typeOf(type.base) : type;
  if (carrier.kind !== "primitive" || carrier.primitive !== "bool")
    return callerDefect("a Boolean switch case without matching selected literal evidence", test.origin);
  return expected;
}

function switchSubject(lowering: Lowering, value: Evaluated): Evaluated | null {
  if (value.operand.kind === "constant") return value;
  const place = lowering.state.places[value.operand.place];
  if (value.kind === "plain" && !value.pendingRead && place?.base.kind === "local"
    && lowering.state.locals[place.base.local]?.role.kind === "temporary") return value;
  return value.anchor === undefined ? readPlace(lowering, value.operand.place, value.storage, value.site) : saveRead(lowering, value);
}

function nextSwitchTest(dispatch: SwitchDispatch, start: number): SwitchTarget<CaseClause<TypedPhase>> | null {
  const clauses = dispatch.node.caseBlock.clauses.nodes;
  for (let position = start; position < clauses.length; position += 1) {
    const node = clauses[position];
    if (node?.kind === "CaseClause") return { node, position };
  }
  return null;
}

function scheduleSwitchTest(lowering: Lowering, test: Extract<Work, { readonly kind: "switch-test" }>): boolean {
  const { node, subject } = test;
  const operation = switchEquality(node, subject);
  pushOperand(lowering, subject);
  lowering.work.push(test, { kind: "operation", node, operation, form: "binary" }, { kind: "expression", node: node.expression });
  return true;
}

export function finishSwitchTest(lowering: Lowering, test: Extract<Work, { readonly kind: "switch-test" }>): boolean {
  const { dispatch, fallback, node, position } = test;
  const result = popOperand(lowering, failure("a switch test completed without its comparison", node.origin));
  const truth = constantOperand(lowering.state, result.storage, { kind: "literal", value: { kind: "boolean", value: true } });
  if (truth === null) return false;
  const match = switchTarget(lowering, dispatch, test);
  if (match === null) return false;
  const next = nextSwitchTest(dispatch, position + 1);
  const otherwise = next === null ? switchTarget(lowering, dispatch, fallback) : newBlock(lowering.state, siteOf(lowering.body, next.node.expression));
  if (otherwise === null) return false;
  terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "switch", operand: result.operand,
    targets: [{ constant: truth.constant, target: match }], otherwise, step: null });
  if (next === null) return true;
  enterBlock(lowering.state, otherwise);
  return scheduleSwitchTest(lowering, { ...test, ...next });
}

function transparentCaseValue(value: TypedValue): boolean {
  return value.conversion.kind === "identity" && value.type === value.convertedType
    && value.narrowing === null && value.demand.kind === "always";
}

export function nextSwitchClause(lowering: Lowering, pending: Extract<Work, { readonly kind: "switch-clause" }>): boolean {
  const { node, scope, enclosing, entries, position } = pending;
  const clauses = node.caseBlock.clauses.nodes;
  if (position === clauses.length) {
    if (scope.exit !== null) {
      if (lowering.state.current !== null) terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "goto", target: scope.exit });
      enterBlock(lowering.state, scope.exit);
    }
    if (lowering.state.current !== null && !leaveLocalScopes(lowering, enclosing, node)) return false;
    lowering.scope = enclosing;
    lowering.labels.delete(node.id);
    return true;
  }
  const clause = clauses[position];
  if (clause === undefined) return callerDefect("a switch clause list has a hole", node.origin);
  lowering.work.push({ ...pending, position: position + 1 });
  const entry = entries.get(position);
  if (entry === undefined && lowering.state.current === null) return true;
  const site = siteOf(lowering.body, clause);
  const block = entry ?? newBlock(lowering.state, site);
  if (block === null) return false;
  if (lowering.state.current !== null) terminate(lowering.state, { ...site, kind: "goto", target: block });
  enterBlock(lowering.state, block);
  const statements = clause.statements.nodes;
  for (let index = statements.length - 1; index >= 0; index -= 1) {
    const statement = statements[index];
    if (statement === undefined) return callerDefect("a switch clause statement list has a hole", clause.origin);
    lowering.work.push({ kind: "statement", node: statement });
  }
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
  if (!leaveLocalScopes(lowering, scope.continuation.locals, node)) return false;
  terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "goto", target: next });
  return true;
}

export function enterFor(lowering: Lowering, { node, headerScope }: Extract<Work, { readonly kind: "for" }>): boolean {
  const { state, body } = lowering;
  const head = newBlock(state, siteOf(body, node.statement));
  if (head === null) return false;
  terminate(state, { ...siteOf(body, node), kind: "goto", target: head });
  enterBlock(state, head);
  const continuation: LoopContinuation = { head, locals: lowering.scope,
    update: node.incrementor === null ? null : { expression: node.incrementor, block: null } };
  const { scope, previous } = placeLoop(lowering, node, continuation);
  if (headerScope !== null) lowering.work.push({ kind: "scope-end", node, scope: headerScope });
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
  const scope: Extract<ControlScope, { readonly kind: "loop" }> = { kind: "loop", node, exit: null, continuation, locals: continuation.locals };
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
  lowering.work.push({ ...pending, kind: "for-next" }, { kind: "discard", node: incrementor, read: null }, { kind: "expression", node: incrementor });
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
  const { scope, previous } = placeLoop(lowering, node, { head, update: null, locals: lowering.scope });
  lowering.work.push({ kind: "while-condition", node, scope, previous }, { kind: "expression", node: node.expression });
  return true;
}

export function loopCondition(lowering: Lowering, pending: Extract<Work, { readonly kind: "for-condition" | "while-condition" | "do-condition" }>): boolean {
  const condition = popOperand(lowering, failure("a loop completed without its condition", pending.node.origin));
  const control = booleanControl(lowering, condition, pending.node);
  if (control === null) return false;
  if (control.kind === "known" && !observePendingRead(lowering, condition)) return false;
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
  const { scope, previous } = placeLoop(lowering, node, { head, update: condition, locals: lowering.scope });
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
