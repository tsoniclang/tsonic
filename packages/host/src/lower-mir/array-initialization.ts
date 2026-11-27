import type { ArrayLiteralExpression } from "../ir-hir/contract.js";
import type { OperationDecision } from "../ir-infer/contract.js";
import type { MirOperand, MirUnwind } from "../ir-mir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import { unwindToHandler } from "./bindings.js";
import type { Lowering, NativeArrayWork } from "./model.js";
import { callerDefect, failure, siteOf } from "./model.js";
import { held, popOperand, pushOperand, saveBeforeControl } from "./operands.js";
import { emitStatement, enterBlock, newBlock, newLocal, placeOfLocal, terminate } from "./state.js";

export function beginNativeArray(lowering: Lowering, node: ArrayLiteralExpression<TypedPhase>, decision: OperationDecision): boolean {
  const { operation, execution, operands, result } = decision;
  if (operation.kind !== "exact-array-construction" || execution.kind !== "array-initialization"
    || operation.parts.length !== node.elements.nodes.length || operands.length !== operation.parts.length
    || lowering.typeOf(result).kind !== "array") return callerDefect("an array requires its actual staged construction", node.origin);
  let range = -1;
  for (let index = 0; index < operation.parts.length; index += 1) {
    const part = operation.parts[index];
    const child = node.elements.nodes[index];
    const spread = child?.kind === "SpreadElement";
    const source = spread ? child.expression : child;
    if (source === undefined || part === undefined || part.kind !== (spread ? "spread" : "element")
      || part.source.body !== lowering.body.body || part.source.node !== source.id)
      return callerDefect("a staged array part must name its actual authored operand", node.origin);
    if (spread) {
      if (range !== -1) return callerDefect("a staged exact-length plan cannot have two ranges", node.origin);
      range = index;
    }
  }
  const pending: NativeArrayWork = { kind: "native-array", node, operation, operands, result, range, position: 0,
    afterOperand: false, started: null };
  const started = range === -1 ? startArray(lowering, pending, null) : null;
  if (range === -1 && started === null) return false;
  lowering.work.push({ ...pending, started });
  return true;
}

function startArray(lowering: Lowering, work: NativeArrayWork, range: MirOperand | null): NativeArrayWork["started"] {
  const { state, body } = lowering;
  const { node, operation } = work;
  const site = siteOf(body, node);
  if (!saveBeforeControl(lowering, false, true)) return null;
  const start = state.current?.id;
  if (start === undefined) return callerDefect("array construction has no open start block", node.origin);
  const local = newLocal(state, work.result, { kind: "temporary" }, "local", null, site.origin);
  if (local === null) return null;
  const place = placeOfLocal(state, local);
  if (place === null) return null;
  const next = newBlock(state, site);
  if (next === null) return null;
  const abort: MirUnwind = { kind: "abort" };
  const unwind = operation.extentFailure === "unwind" || operation.allocationFailure === "unwind"
    ? unwindToHandler(lowering, node) : abort;
  if (unwind === null) return null;
  terminate(state, { ...site, kind: "array-start", place, range, next,
    extentFailure: operation.extentFailure === "abort" ? abort : unwind,
    allocationFailure: operation.allocationFailure === "abort" ? abort : unwind });
  enterBlock(state, next);
  return { start, place };
}

export function nativeArray(lowering: Lowering, work: NativeArrayWork): boolean {
  const { node, position } = work;
  const { state, body } = lowering;
  if (position === work.operation.parts.length) {
    const stage = work.started;
    if (stage === null) return callerDefect("a staged array cannot finish before its start", node.origin);
    const site = siteOf(body, node);
    if (!emitStatement(state, { ...site, kind: "array-finish", start: stage.start })) return false;
    pushOperand(lowering, held(stage.place, work.result, site));
    return true;
  }
  const child = node.elements.nodes[position];
  if (child === undefined) return callerDefect("a staged array has no selected part", node.origin);
  const source = child.kind === "SpreadElement" ? child.expression : child;
  if (!work.afterOperand) {
    lowering.work.push({ ...work, afterOperand: true }, { kind: "expression", node: source });
    return true;
  }
  let started = work.started;
  if (position === work.range) {
    const range = popOperand(lowering, failure("a range has no evaluated operand", source.origin));
    if (started !== null || range.storage !== work.operands[position] || work.operation.holding === "in-place" && range.operand.kind !== "place")
      return callerDefect("array construction requires its actual reached range", source.origin);
    started = startArray(lowering, work, range.operand);
    if (started === null) return false;
    const prefix: MirOperand[] = [];
    for (let index = position - 1; index >= 0; index -= 1) {
      const value = popOperand(lowering, failure("a saved array prefix is incomplete", source.origin));
      if (value.storage !== work.operands[index]) return callerDefect("an array scalar must retain its selected storage", value.site.origin);
      prefix[index] = value.operand;
    }
    for (const [index, operand] of prefix.entries()) {
      const element = node.elements.nodes[index];
      if (element === undefined) return callerDefect("a staged array has no selected prefix part", node.origin);
      if (!emitStatement(state, { ...siteOf(body, element), kind: "array-element", start: started.start, part: index, operand })) return false;
    }
    if (!emitStatement(state, { ...siteOf(body, source), kind: "array-range", start: started.start, part: position })) return false;
  } else if (started !== null) {
    const value = popOperand(lowering, failure("an array scalar has no evaluated operand", source.origin));
    if (value.storage !== work.operands[position]) return callerDefect("an array scalar must retain its selected storage", source.origin);
    if (!emitStatement(state, { ...siteOf(body, source), kind: "array-element", start: started.start, part: position, operand: value.operand })) return false;
  }
  lowering.work.push({ ...work, position: position + 1, afterOperand: false, started });
  return true;
}
