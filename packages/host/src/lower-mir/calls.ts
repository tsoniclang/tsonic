import { requirePresent } from "../diag/index.js";
import type { LocalId } from "../ids/contract.js";
import type { CallExpression, Expression, NewExpression } from "../ir-hir/contract.js";
import type { MirCallArgument } from "../ir-mir/contract.js";
import type { TypedPhase, TypedValue } from "../ir-tir/contract.js";
import type { Lowering, Work } from "./model.js";
import { callerDefect, failure, localFromSource, notLoweredYet, siteOf } from "./model.js";
import { exposeLocal, held, popOperand, pushOperand, saveHandedOut, temporary } from "./operands.js";
import { constantOperand, enterBlock, newBlock, placeOfLocal, terminate } from "./state.js";

export function enterCall(lowering: Lowering, node: CallExpression<TypedPhase> | NewExpression<TypedPhase>): boolean {
  const selected = node.tsonic;
  if (selected.operation !== null) return notLoweredYet("a call with a selected operation", node.origin);
  if (selected.application.kind !== "decided") return callerDefect("a deferred call application", node.origin);
  const application = selected.application.decision;
  const signature = lowering.signatureOf(application.callee.decision.api.signature);
  if (signature.kind !== (node.kind === "NewExpression" ? "construct" : "call"))
    return callerDefect("an application has another selected invocation kind", node.origin);
  if (application.receiver !== null) return notLoweredYet("a call with a receiver", node.origin);
  const callee = node.expression;
  const direct = callee.kind === "Identifier" && callee.tsonic.role === "value" && callee.tsonic.resolution.kind === "definition";
  if (direct && node.kind === "CallExpression" && callee.tsonic.resolution.definition !== application.callee.decision.advertised.declaration)
    return callerDefect("a direct call target differs from its selected declaration", node.origin);
  lowering.work.push({ kind: "call", node, application, direct });
  const arguments_ = node.arguments?.nodes;
  for (let position = (arguments_?.length ?? 0) - 1; position >= 0; position -= 1) {
    const argument = requirePresent(arguments_?.[position], failure("a call argument list contains a hole", node.origin));
    if (argument.kind === "SpreadElement") return notLoweredYet("a spread call argument", argument.origin);
    const mapping = application.callee.decision.parameters[position];
    lowering.work.push({ kind: mapping?.kind === "argument" && mapping.passing !== "by-value" && mapping.passing !== "move"
      ? "argument-place" : "expression", node: argument });
  }
  if (!direct) lowering.work.push({ kind: "expression", node: callee });
  return true;
}

export function argumentPlace(lowering: Lowering, node: Expression<TypedPhase>): boolean {
  let target = node;
  while (target.kind === "ParenthesizedExpression") {
    if (target.tsonic.conversion.kind !== "identity" || target.tsonic.narrowing !== null)
      return callerDefect("a place argument has a value conversion or narrowing", target.origin);
    target = target.expression;
  }
  let selected: TypedValue;
  let local: LocalId | undefined;
  if (target.kind === "Identifier") {
    if (target.tsonic.role !== "value") return callerDefect("a place argument without its selected value", target.origin);
    selected = target.tsonic;
    if (target.tsonic.resolution.kind !== "local") return notLoweredYet(`a place argument resolved to a ${target.tsonic.resolution.kind}`, target.origin);
    local = localFromSource(lowering, target.tsonic.resolution.local);
  } else if (target.kind === "ThisKeyword") {
    if (target.tsonic.role !== "receiver") return callerDefect("a place argument without its selected receiver", target.origin);
    selected = target.tsonic;
    local = lowering.receiver ?? undefined;
  } else return notLoweredYet(`a place argument of kind ${target.kind}`, target.origin);
  if (selected.conversion.kind !== "identity" || selected.narrowing !== null)
    return callerDefect("a place argument has a value conversion or narrowing", target.origin);
  if (local === undefined) return callerDefect("a place argument has no local storage in the body", target.origin);
  const place = placeOfLocal(lowering.state, local);
  if (place === null) return false;
  pushOperand(lowering, held(place, selected.convertedType, siteOf(lowering.body, node)));
  return true;
}

export function finishCall(lowering: Lowering, pending: Extract<Work, { readonly kind: "call" }>): boolean {
  const { node, application } = pending;
  const decision = application.callee.decision;
  const sourceArguments = node.arguments?.nodes;
  const sourceCount = sourceArguments?.length ?? 0;
  if (application.arguments.length < sourceCount || decision.parameters.length !== application.arguments.length)
    return notLoweredYet("a call with unmatched argument and parameter inventories", node.origin);
  const arguments_: MirCallArgument[] = [];
  let argument = sourceCount - 1;
  let supplied = false;
  for (let position = application.arguments.length - 1; position >= 0; position -= 1) {
    const selected = requirePresent(application.arguments[position], failure("a call has no selected argument", node.origin));
    const mapping = requirePresent(decision.parameters[position], failure("a call has no selected parameter", node.origin));
    if (selected.parameter !== position || mapping.parameter !== position)
      return callerDefect("a call argument differs from its actual selected mapping", node.origin);
    if (selected.kind === "omitted") {
      if (supplied) return callerDefect("an omitted call argument precedes a supplied parameter", node.origin);
      if (mapping.kind === "rest" || selected.value.kind === "empty-rest") return notLoweredYet("a rest call argument", node.origin);
      if (mapping.kind === "default" && selected.value.kind === "initializer") {
        if (mapping.initializer !== selected.value.instance.body) return callerDefect("an omitted call argument names another initializer", node.origin);
      } else if (!(mapping.kind === "omitted" && selected.value.kind === "absence"))
        return callerDefect("an omitted call argument differs from its selected default", node.origin);
      const parameter = lowering.signatureOf(decision.api.signature).parameters[position];
      if (parameter === undefined || !parameter.acceptsOmission)
        return callerDefect("an omitted call argument lacks its selected omission capability", node.origin);
      arguments_.push({ kind: "omitted" });
      continue;
    }
    supplied = true;
    if (selected.kind !== "provided" || mapping.kind !== "argument" || mapping.component !== null)
      return notLoweredYet("a call with omitted, rest or expanded arguments", node.origin);
    const authored = requirePresent(sourceArguments?.[argument], failure("a call has a selected argument without its source", node.origin));
    if (selected.expression !== authored.id || mapping.argument !== argument)
      return callerDefect("a call argument differs from its actual selected mapping", node.origin);
    const value = popOperand(lowering, failure("a call completed without its argument", node.origin));
    if (mapping.passing === "by-value" || mapping.passing === "move")
      arguments_.push({ kind: "value", passing: mapping.passing, operand: value.operand });
    else {
      if (value.operand.kind !== "place") return callerDefect("a place argument completed without a place", node.origin);
      const place = requirePresent(lowering.state.places[value.operand.place], failure("a place argument has no allocated storage", node.origin));
      if (place.base.kind !== "local") return callerDefect("a local place argument has a projected place", node.origin);
      if (mapping.passing !== "byref-readonly" && mapping.passing !== "borrow-shared") exposeLocal(lowering, place.base.local);
      arguments_.push({ kind: "place", passing: mapping.passing, place: value.operand.place });
    }
    argument -= 1;
  }
  if (argument !== -1) return callerDefect("a call has source arguments absent from its selection", node.origin);
  arguments_.reverse();
  const target = pending.direct ? null : popOperand(lowering, failure("an indirect call completed without its evaluated target", node.origin));
  if (!saveHandedOut(lowering)) return false;
  const site = siteOf(lowering.body, node);
  const type = lowering.typeOf(decision.result);
  const result = type.kind === "intrinsic" && type.intrinsic === "void" ? null : temporary(lowering, decision.result, site);
  if (result === null && !(type.kind === "intrinsic" && type.intrinsic === "void")) return false;
  const nextWork = requirePresent(lowering.work.at(-1), failure("a call was evaluated with nothing to consume it", node.origin));
  const next = newBlock(lowering.state, siteOf(lowering.body, nextWork.node));
  if (next === null) return false;
  terminate(lowering.state, { ...site, kind: "call", callee: target === null ? { kind: "direct", resolution: application.callee }
    : { kind: "indirect", operand: target.operand, resolution: application.callee }, receiver: null,
    arguments: arguments_, destination: result, next, unwind: { kind: "escape" }, step: null });
  enterBlock(lowering.state, next);
  if (result !== null) pushOperand(lowering, held(result, decision.result, site));
  else {
    const absent = constantOperand(lowering.state, decision.result, { kind: "literal", value: { kind: "absence" } });
    if (absent === null) return false;
    pushOperand(lowering, { operand: absent, inPlace: null, storage: decision.result, site });
  }
  return true;
}
