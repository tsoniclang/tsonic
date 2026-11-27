import { requirePresent } from "../diag/index.js";
import type { LocalId } from "../ids/contract.js";
import type { CallExpression, Expression, NewExpression } from "../ir-hir/contract.js";
import { unparenthesizedExpression } from "../ir-hir/index.js";
import type { MirCallArgument } from "../ir-mir/contract.js";
import type { TirApplication, TypedApplication, TypedPhase, TypedValue } from "../ir-tir/contract.js";
import type { Signature } from "../ir-types/contract.js";
import type { Lowering, Work } from "./model.js";
import { callerDefect, executingValue, failure, localFromSource, notLoweredYet, siteOf, workNode } from "./model.js";
import { exposeLocal, held, popOperand, pushOperand, readPlace, saveBeforeControl, temporary, tupleElementPlace } from "./operands.js";
import { enterBlock, newBlock, placeOfLocal, terminate } from "./state.js";
import { unwindToHandler } from "./bindings.js";

export function enterCall(lowering: Lowering, node: CallExpression<TypedPhase> | NewExpression<TypedPhase>, selected: TypedApplication): boolean {
  if (selected.operation !== null) return notLoweredYet("a call with a selected operation", node.origin);
  if (selected.application.kind !== "decided") return callerDefect("a deferred call application", node.origin);
  const application = selected.application.decision;
  const signature = lowering.signatureOf(application.callee.decision.completion.signature);
  if (signature.kind !== (node.kind === "NewExpression" ? "construct" : "call"))
    return callerDefect("an application has another selected invocation kind", node.origin);
  if (application.receiver !== null) return notLoweredYet("a call with a receiver", node.origin);
  const callee = unparenthesizedExpression<TypedPhase>(node.expression);
  const direct = callee.kind === "Identifier" && callee.tsonic.role === "value" && callee.tsonic.resolution.kind === "definition";
  if (direct && node.kind === "CallExpression" && callee.tsonic.resolution.definition !== application.callee.decision.advertised.declaration) {
    const { advertised, api } = application.callee.decision;
    const carrier = lowering.typeOf(callee.tsonic.type);
    if (application.callee.activation !== null || api.body !== null || api.role !== "api-signature"
      || carrier.kind !== "callable" || !carrier.calls.includes(advertised.signature)
      || lowering.signatureOf(advertised.signature).declaration !== api.declaration)
      return callerDefect("a direct call target differs from its selected declaration", node.origin);
  }
  lowering.work.push({ kind: "call", node, application, direct });
  const list = node.arguments;
  if (list !== null && "kind" in list) return callerDefect("a layout quotation is not a runtime call argument", node.origin);
  const arguments_ = list?.nodes;
  const parameters = application.callee.decision.parameters;
  let end = validateCallArguments(node, application, signature, arguments_);
  for (let position = (arguments_?.length ?? 0) - 1; position >= 0; position -= 1) {
    const argument = requirePresent(arguments_?.[position], failure("a call argument list contains a hole", node.origin));
    const tail = end;
    for (; end > 0; end -= 1) {
      const mapping = parameters[end - 1];
      if ((mapping?.kind !== "argument" && mapping?.kind !== "reference-argument") || mapping.argument !== position) break;
    }
    const count = tail - end;
    if (argument.kind === "SpreadElement") {
      if (count === 0 && (!("role" in argument.tsonic) || argument.tsonic.role !== "finite-call-argument"))
        return notLoweredYet("a spread call argument", argument.origin);
      for (let index = 0; index < count; index += 1) {
        const slot = parameters[end + index];
        if (slot?.kind !== "argument" || slot.component !== index || slot.passing !== "by-value")
          return callerDefect("a finite call spread must retain its ordered selected value slots", argument.origin);
      }
      lowering.work.push(count === 0 ? { kind: "discard", node: argument, read: null }
        : { kind: "call-spread", node: argument, count });
      lowering.work.push({ kind: "expression", node: argument.expression });
      continue;
    }
    if (count !== 1) return callerDefect("a call has source arguments absent from its selection", argument.origin);
    const mapping = parameters[end];
    lowering.work.push({ kind: mapping?.kind === "argument" && mapping.passing !== "by-value" && mapping.passing !== "move"
      ? "argument-place" : "expression", node: argument });
  }
  if (end !== 0) return callerDefect("a call argument differs from its actual selected mapping", node.origin);
  if (!direct) lowering.work.push({ kind: "expression", node: node.expression });
  return true;
}

function validateCallArguments(node: CallExpression<TypedPhase> | NewExpression<TypedPhase>, application: TirApplication,
  signature: Signature, arguments_: readonly Expression<TypedPhase>[] | undefined): number {
  const parameters = application.callee.decision.parameters;
  if (parameters.length !== application.arguments.length)
    return notLoweredYet("a call with unmatched argument and parameter inventories", node.origin);
  let provided = 0;
  for (let position = parameters.length - 1; position >= 0; position -= 1) {
    const selected = requirePresent(application.arguments[position], failure("a call has no selected argument", node.origin));
    const mapping = requirePresent(parameters[position], failure("a call has no selected parameter", node.origin));
    if (selected.parameter !== position || mapping.parameter !== position)
      return callerDefect("a call argument differs from its actual selected mapping", node.origin);
    if (selected.kind === "omitted") {
      if (provided !== 0) return callerDefect("an omitted call argument precedes a supplied parameter", node.origin);
      if (mapping.kind === "rest" || selected.value.kind === "empty-rest") return notLoweredYet("a rest call argument", node.origin);
      if (mapping.kind === "default" && selected.value.kind === "initializer") {
        if (mapping.initializer !== selected.value.instance.body) return callerDefect("an omitted call argument names another initializer", node.origin);
      } else if (!(mapping.kind === "omitted" && selected.value.kind === "absence"))
        return callerDefect("an omitted call argument differs from its selected default", node.origin);
      if (signature.parameters[position]?.acceptsOmission !== true)
        return callerDefect("an omitted call argument lacks its selected omission capability", node.origin);
      continue;
    }
    if (selected.kind !== "provided" || mapping.kind !== "argument" && mapping.kind !== "reference-argument")
      return notLoweredYet("a call with omitted, rest or expanded arguments", node.origin);
    const authored = arguments_?.[mapping.argument];
    const spread = authored?.kind === "SpreadElement";
    if (spread && (!("role" in authored.tsonic) || authored.tsonic.role !== "finite-call-argument"))
      return notLoweredYet("a spread call argument", authored.origin);
    if (spread !== (mapping.component !== null)) return notLoweredYet("a call with omitted, rest or expanded arguments", node.origin);
    if (authored === undefined || selected.expression !== (spread ? authored.expression.id : authored.id))
      return callerDefect("a call argument differs from its actual selected mapping", node.origin);
    provided += 1;
  }
  return provided;
}

export function finishCallSpread(lowering: Lowering, { node, count }: Extract<Work, { readonly kind: "call-spread" }>): boolean {
  const source = popOperand(lowering, failure("a call spread completed without its actual operand", node.origin));
  const tuple = lowering.typeOf(source.storage);
  if (tuple.kind !== "tuple" || tuple.elements.length !== count || source.operand.kind !== "place")
    return callerDefect("a finite call spread requires its evaluated tuple place and exact selected slots", node.origin);
  const site = siteOf(lowering.body, node);
  for (let index = 0; index < count; index += 1) {
    const slot = tuple.elements[index];
    if (slot?.kind !== "required") return callerDefect("a finite call spread requires its actual required tuple slot", node.origin);
    const place = tupleElementPlace(lowering, source.operand.place, index, slot.type, site);
    if (place === null) return false;
    const value = readPlace(lowering, place, slot.type, site);
    if (value === null) return false;
    pushOperand(lowering, value);
  }
  return true;
}

export function argumentPlace(lowering: Lowering, node: Expression<TypedPhase>): boolean {
  let target = node;
  while (target.kind === "ParenthesizedExpression") {
    const wrapper = executingValue(target.tsonic, target.origin);
    if (wrapper.conversion.kind !== "identity" || wrapper.narrowing !== null)
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
  const arguments_: MirCallArgument[] = [];
  for (let position = application.arguments.length - 1; position >= 0; position -= 1) {
    const selected = requirePresent(application.arguments[position], failure("a call has no selected argument", node.origin));
    const mapping = requirePresent(decision.parameters[position], failure("a call has no selected parameter", node.origin));
    if (selected.kind === "omitted") {
      arguments_.push({ kind: "omitted" });
      continue;
    }
    if (selected.kind !== "provided" || mapping.kind !== "argument" && mapping.kind !== "reference-argument")
      return callerDefect("a call argument differs from its actual selected mapping", node.origin);
    const value = popOperand(lowering, failure("a call completed without its argument", node.origin));
    if (mapping.kind === "reference-argument" && value.storage !== mapping.view.caller)
      return callerDefect("a reference argument retains its actual caller storage", node.origin);
    if (mapping.passing === "by-value" || mapping.passing === "move")
      arguments_.push({ kind: "value", passing: mapping.passing, operand: value.operand });
    else {
      if (value.operand.kind !== "place") return callerDefect("a place argument completed without a place", node.origin);
      const place = requirePresent(lowering.state.places[value.operand.place], failure("a place argument has no allocated storage", node.origin));
      if (place.base.kind !== "local") return callerDefect("a local place argument has a projected place", node.origin);
      if (mapping.passing !== "byref-readonly" && mapping.passing !== "borrow-shared") exposeLocal(lowering, place.base.local);
      arguments_.push({ kind: "place", passing: mapping.passing, place: value.operand.place });
    }
  }
  arguments_.reverse();
  const target = pending.direct ? null : popOperand(lowering, failure("an indirect call completed without its evaluated target", node.origin));
  if (!saveBeforeControl(lowering, true, true)) return false;
  const site = siteOf(lowering.body, node);
  const type = lowering.typeOf(decision.result);
  const returnsVoid = type.kind === "intrinsic" && type.intrinsic === "void";
  const nextWork = requirePresent(lowering.work.at(-1), failure("a call was evaluated with nothing to consume it", node.origin));
  if (returnsVoid && nextWork.kind !== "discard"
    && (nextWork.kind !== "complete" || nextWork.node.kind === "ThrowStatement" || lowering.body.completion !== decision.result))
    return notLoweredYet("a void call with a value consumer", node.origin);
  const needsDestination = !returnsVoid && nextWork.kind !== "discard";
  const result = needsDestination ? temporary(lowering, decision.result, site) : null;
  if (needsDestination && result === null) return false;
  const next = newBlock(lowering.state, siteOf(lowering.body, workNode(nextWork)));
  if (next === null) return false;
  const unwind = unwindToHandler(lowering, node);
  if (unwind === null) return false;
  terminate(lowering.state, { ...site, kind: "call", callee: target === null ? { kind: "direct", resolution: application.callee }
    : { kind: "indirect", operand: target.operand, resolution: application.callee }, receiver: null,
    arguments: arguments_, destination: result, next, unwind, step: null });
  enterBlock(lowering.state, next);
  if (result !== null) pushOperand(lowering, held(result, decision.result, site));
  else {
    lowering.work.pop();
    if (nextWork.kind === "complete") lowering.work.push({ ...nextWork, result: "void" });
  }
  return true;
}
