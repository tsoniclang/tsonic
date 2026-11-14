import { requirePresent } from "../diag/index.js";
import type { CallExpression } from "../ir-hir/contract.js";
import type { MirCallArgument } from "../ir-mir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { Lowering, Work } from "./model.js";
import { callerDefect, failure, notLoweredYet, siteOf } from "./model.js";
import { held, popOperand, pushOperand, saveHandedOut, temporary } from "./operands.js";
import { constantOperand, enterBlock, newBlock, terminate } from "./state.js";

export function enterCall(lowering: Lowering, node: CallExpression<TypedPhase>): boolean {
  const selected = node.tsonic;
  if (selected.operation !== null) return notLoweredYet("a call with a selected operation", node.origin);
  if (selected.application.kind !== "decided") return callerDefect("a deferred call application", node.origin);
  const application = selected.application.decision;
  if (application.receiver !== null) return notLoweredYet("a call with a receiver", node.origin);
  const callee = node.expression;
  if (callee.kind !== "Identifier" || callee.tsonic.role !== "value" || callee.tsonic.resolution.kind !== "definition")
    return notLoweredYet("an evaluated call target", node.origin);
  if (callee.tsonic.resolution.definition !== application.callee.decision.advertised.declaration)
    return callerDefect("a direct call target differs from its selected declaration", node.origin);
  lowering.work.push({ kind: "call", node, application });
  for (let position = node.arguments.nodes.length - 1; position >= 0; position -= 1) {
    const argument = requirePresent(node.arguments.nodes[position], failure("a call argument list contains a hole", node.origin));
    if (argument.kind === "SpreadElement") return notLoweredYet("a spread call argument", argument.origin);
    lowering.work.push({ kind: "expression", node: argument });
  }
  return true;
}

export function finishCall(lowering: Lowering, pending: Extract<Work, { readonly kind: "call" }>): boolean {
  const { node, application } = pending;
  const decision = application.callee.decision;
  if (application.arguments.length !== node.arguments.nodes.length || decision.parameters.length !== application.arguments.length)
    return notLoweredYet("a call with omitted or rest parameters", node.origin);
  const arguments_: MirCallArgument[] = [];
  for (let position = node.arguments.nodes.length - 1; position >= 0; position -= 1) {
    const selected = requirePresent(application.arguments[position], failure("a call has no selected argument", node.origin));
    const mapping = requirePresent(decision.parameters[position], failure("a call has no selected parameter", node.origin));
    const authored = requirePresent(node.arguments.nodes[position], failure("a call argument list contains a hole", node.origin));
    if (selected.kind !== "provided" || mapping.kind !== "argument" || mapping.component !== null)
      return notLoweredYet("a call with omitted, rest or expanded arguments", node.origin);
    if (selected.parameter !== position || selected.expression !== authored.id || mapping.parameter !== position || mapping.argument !== position)
      return callerDefect("a call argument differs from its actual selected mapping", node.origin);
    if (mapping.passing !== "by-value" && mapping.passing !== "move") return notLoweredYet("a place-passed call argument", node.origin);
    const value = popOperand(lowering, failure("a call completed without its argument", node.origin));
    arguments_.push({ kind: "value", passing: mapping.passing, operand: value.operand });
  }
  arguments_.reverse();
  if (!saveHandedOut(lowering)) return false;
  const site = siteOf(lowering.body, node);
  const type = lowering.typeOf(decision.result);
  const result = type.kind === "intrinsic" && type.intrinsic === "void" ? null : temporary(lowering, decision.result, site);
  if (result === null && !(type.kind === "intrinsic" && type.intrinsic === "void")) return false;
  const nextWork = requirePresent(lowering.work.at(-1), failure("a call was evaluated with nothing to consume it", node.origin));
  const next = newBlock(lowering.state, siteOf(lowering.body, nextWork.node));
  if (next === null) return false;
  terminate(lowering.state, { ...site, kind: "call", callee: { kind: "direct", resolution: application.callee }, receiver: null,
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
