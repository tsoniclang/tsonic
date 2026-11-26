import type { Diagnostic, Result } from "../diag/contract.js";
import { requirePresent, resourceLimitDiagnostic } from "../diag/index.js";
import type { BodyId, LocalId, LocalRef, PlaceId, TyId } from "../ids/contract.js";
import type { BinaryExpression, Expression, NodeHeader, ParameterDeclaration, Statement } from "../ir-hir/contract.js";
import { shortCircuitOperatorOf } from "../ir-hir/index.js";
import type { MirBody, MirLocalRole, MirOperand, MirUnwind } from "../ir-mir/contract.js";
import { localOwnershipOfMir } from "../ir-mir/index.js";
import type { TirBody, TirEnumResolution, TirLocal, TypedBinary, TypedOperation, TypedPhase, TypedUnary, TypedValue } from "../ir-tir/contract.js";
import { layoutObservationOf, rawValueTypeOf as rawType } from "../ir-tir/index.js";
import type { LiteralValue } from "../ir-types/contract.js";
import type { CheckFailure } from "../ir-types/contract.js";
import type { InternalBodyInput, LowerMirDeps } from "./contract.js";
import type { CheckedWrite, ControlScope, Discard, Evaluated, FieldReceiver, Lowering, Work } from "./model.js";
import { callerDefect, executingValue, failure, localFromSource, notLoweredYet, siteOf, workNode } from "./model.js";
import { held, holdReceiver, observePendingRead, popOperand, pushOperand, readPlace, saveBeforeControl, saveBeforeStore, saveRead, temporary } from "./operands.js";
import { breaks, continues, endCleanup, endConditionalFalse, endConditionalTrue, endDo, endElse, endFor, endHandler, endLabel, endProtected, endSelected, endShortCircuit, endThen, endWhile, enterConditional, enterDo, enterFor, enterIf, enterProtected, enterShortCircuit, enterSwitch, enterWhile, finishSwitchTest, loopCondition, nextFor, nextSwitchClause } from "./control.js";
import { argumentPlace, enterCall, finishCall } from "./calls.js";
import { beginLocalScope, declareLocal, declarations, endLocalScope, enterLocalBlock, initializeAbsence, initializeLocal, leaveProtectedScopes, nextDeclaration, prepareFunctionLocals, unwindToHandler } from "./bindings.js";
import { addEntry, constantOperand, createState, emitStatement, enterBlock, finishBody, newBlock, newLocal, newPlace, placeOfLocal, placeOfStatic, terminate } from "./state.js";
import { placeCheckAvailable, placeCheckStamp } from "./state.js";

// The lowering of one typed body into its MIR graph.
//
// Nothing is selected here. Whether an operation is a statement or a control point, how a control point fails and
// whether it writes existing storage are read from the decision the node carries; a parameter's local is the body's
// own cell or the caller's storage as its row's passing mode says.
//
// The walk. A stack of pending work and a stack of evaluated operands; no native recursion in proportion to the
// nesting of the source. A node's operands are evaluated left to right, each once, and the operation is emitted
// when all of them are on the operand stack.
//
// Sites. Every record names a node of the typed body. A block names the node whose evaluation it starts; a storage
// marker names the node whose value its slot holds; an operation, and the temporary it writes, name the node of the
// operation; a return names the return statement.
//
// An operand read in place. The operand of a local is its own place, with no copy, while no record emitted between
// its evaluation and its use can write that local. A local that is not handed out is written only by a record that
// names it. A local that is handed out can also be written by a control point whose decision says it writes existing
// storage: before such a control point every operand already evaluated from a handed-out local is saved into a
// temporary, so that the value used is the one read at its authored position.
//
// Refusal. The size limit is the state's: a primitive that answers null or false has refused. Every step tests that
// answer before it makes the next record and the walk ends at the first refusal with the one diagnostic. No record
// is made after a refusal.
//
export function lowerBody(deps: LowerMirDeps, body: TirBody, internal: readonly InternalBodyInput[], provided: readonly number[]): Result<MirBody> {
  // The caller sets the limit; a value that is not a count is the caller's defect, as for the MIR verifier's limit.
  const maximumRecords = deps.limits.maximumRecords;
  if (!Number.isSafeInteger(maximumRecords) || maximumRecords < 0 || Object.is(maximumRecords, -0))
    throw new TypeError("lower-mir: maximumRecords must be a safe nonnegative count");
  const root = body.root;
  if (body.bindings.kind !== "instantiated")
    return callerDefect("LowerMir requires the selected complete body instance, not its parametric template", root.origin);
  if (body.asynchronous || body.generator) return notLoweredYet("an asynchronous body or a generator", root.origin);
  const lowering: Lowering = { state: createState(body.body, body.bindings, body.completion, deps.limits), typeOf: deps.typeOf,
    signatureOf: deps.signatureOf, internal, internalOf: null, body, work: [], operands: [],
    exposed: new Set(), reads: new Map(), sharedReads: new Set(), selections: new Map(), localOf: new Map(), labels: new Map(), preservedLocals: new Set(), receiver: null,
    outerLocals: new Map(), scope: null, protection: null };
  const mir = enter(lowering, root) && walk(lowering) ? finish(lowering, provided) : null;
  return mir === null ? { kind: "refused", diagnostics: [sizeLimit(deps, body)] } : { kind: "ok", value: mir, diagnostics: [] };
}

/**
 * The one diagnostic lowering originates (§7 part 7): the shared resource-limit diagnostic, for the limit named here
 * (its only spelling), at the body's origin, against the query unit Pipeline gave.
 */
function sizeLimit(deps: LowerMirDeps, body: TirBody): Diagnostic {
  return resourceLimitDiagnostic({ owner: "lower-mir", limit: "lower-mir.maximumRecords", maximum: deps.limits.maximumRecords,
    site: { kind: "source", origin: body.root.origin }, unit: deps.unit });
}

function executionParameterLocal(header: ParameterDeclaration<TypedPhase>, body: BodyId): LocalRef {
  const local = header.tsonic.local;
  if (local === null || local.body !== body)
    return callerDefect("a parameter requires its actual executing body local and passing", header.origin);
  return local;
}

/** The locals present on entry, the first block and the entry. False: refused. */
function enter(lowering: Lowering, root: TirBody["root"]): boolean {
  const { state, body } = lowering;
  if (root.kind === "SourceFile" && body.params.length !== 0)
    return callerDefect("a module initializer has callable parameters", root.origin);
  if (body.captures.length > state.limits.maximumRecords - state.records) return false;
  const capturedLocals = body.captures.length === 0 ? null : captureIndex(body, root);
  let parameters = 0;
  for (const header of body.params) {
    const row = header.tsonic;
    const parameterLocal = executionParameterLocal(header, body.body);
    if (row.passing === null)
      return callerDefect("a parameter requires its actual executing body local and passing", header.origin);
    if (row.role === "rest") return notLoweredYet("a parameter of role rest", root.origin);
    if (header.initializer.kind !== "none" && row.initializer === null)
      return notLoweredYet("a parameter initializer without its placed execution", header.origin);
    if (row.role === "this" && lowering.receiver !== null) return callerDefect("two selected receiver parameter rows", root.origin);
    const role: MirLocalRole = row.role === "this" ? { kind: "receiver" } : { kind: "parameter", index: parameters };
    const local = newLocal(state, row.storage, role, row.passing,
      parameterLocal, header.origin);
    if (local === null) return false;
    if (row.role !== "this") parameters += 1;
    else lowering.receiver = local;
    lowering.localOf.set(parameterLocal.local, local);
    // The local of a row not passed by value or moved is the caller's storage: handed out from entry.
    if (localOwnershipOfMir(row.passing) === "external") lowering.preservedLocals.add(local);
  }
  if (capturedLocals !== null) for (const [index, capture] of body.captures.entries()) {
    const source = requirePresent(capturedLocals.get(index), failure("a validated capture has no actual local slot", root.origin));
    const local = newLocal(state, source.storage, { kind: "capture", index }, capture.capture, capture.local, root.origin);
    if (local === null) return false;
    lowering.localOf.set(source.id, local);
    let outer = lowering.outerLocals.get(capture.local.body);
    if (outer === undefined) { outer = new Map(); lowering.outerLocals.set(capture.local.body, outer); }
    outer.set(capture.local.local, local);
    if (localOwnershipOfMir(capture.capture) !== "body") lowering.preservedLocals.add(local);
  }
  const first = newBlock(state, siteOf(body, root));
  if (first === null) return false;
  enterBlock(state, first);
  if (!prepareFunctionLocals(lowering)) return false;
  if (root.kind === "SourceFile") lowering.work.push({ kind: "module", node: root, position: 0 });
  else if (root.kind === "Block") lowering.work.push({ kind: "statement", node: root });
  else lowering.work.push({ kind: "complete", node: root, result: "value" }, { kind: "expression", node: root });
  return true;
}

function captureIndex(body: TirBody, root: NodeHeader): ReadonlyMap<number, TirLocal> {
  const rows = new Map<BodyId, Map<LocalId, number>>();
  const locals = new Map<number, TirLocal>();
  for (const [index, capture] of body.captures.entries()) {
    if (capture.local.body === body.body) return callerDefect("a capture names its own body", root.origin);
    if (capture.capture === null)
      return callerDefect("an undecided capture in a selected body", root.origin);
    let selected = rows.get(capture.local.body);
    if (selected === undefined) { selected = new Map(); rows.set(capture.local.body, selected); }
    if (selected.has(capture.local.local)) return callerDefect("a duplicate qualified capture", root.origin);
    selected.set(capture.local.local, index);
  }
  for (const local of body.locals) {
    if (local.role !== "capture") continue;
    const from = local.capturedFrom;
    if (from === null) return callerDefect("a captured local without its qualified source", root.origin);
    const index = rows.get(from.body)?.get(from.local);
    if (index === undefined) return callerDefect("a captured local absent from the capture rows", root.origin);
    if (locals.has(index)) return callerDefect("two local slots for one capture", root.origin);
    locals.set(index, local);
  }
  if (locals.size !== body.captures.length) return callerDefect("a capture without its actual local slot", root.origin);
  return locals;
}

/** Runs the pending work to its end. False: refused. */
function walk(lowering: Lowering): boolean {
  for (let next = lowering.work.pop(); next !== undefined; next = lowering.work.pop()) {
    const done = next.kind === "module" ? moduleStatement(lowering, next)
      : next.kind === "statement" ? statement(lowering, next.node)
      : next.kind === "expression" ? expression(lowering, next.node)
        : next.kind === "conditional" ? enterConditional(lowering, next.node)
          : next.kind === "short-circuit" ? enterShortCircuit(lowering, next.node, null)
            : next.kind === "short-circuit-end" ? endShortCircuit(lowering, next)
          : next.kind === "conditional-true" ? endConditionalTrue(lowering, next)
            : next.kind === "conditional-false" ? endConditionalFalse(lowering, next)
              : next.kind === "selected-end" ? endSelected(lowering, next)
        : next.kind === "declaration" ? declareLocal(lowering, next.node, next.lexical)
          : next.kind === "declarations" ? nextDeclaration(lowering, next)
          : next.kind === "scope-end" ? endLocalScope(lowering, next.node, next.scope)
        : next.kind === "argument-place" ? argumentPlace(lowering, next.node)
        : next.kind === "call" ? finishCall(lowering, next)
        : next.kind === "field-read" ? fieldRead(lowering, next)
        : next.kind === "field-assignment" ? fieldAssignment(lowering, next)
        : next.kind === "index-receiver" ? indexReceiver(lowering, next)
        : next.kind === "index-key" ? indexKey(lowering, next)
        : next.kind === "void-result" ? pushLiteral(lowering, next.node, next.storage, { kind: "absence" })
        : next.kind === "operation" ? operation(lowering, next)
          : next.kind === "narrow" ? narrow(lowering, next.node, next.narrowing)
            : next.kind === "label-end" ? endLabel(lowering, next.node, next.scope)
              : next.kind === "for" ? enterFor(lowering, next)
                : next.kind === "for-end" ? endFor(lowering, next)
                  : next.kind === "for-next" ? nextFor(lowering, next)
                    : next.kind === "discard" ? discard(lowering, next)
                      : next.kind === "store" ? store(lowering, next)
                        : next.kind === "if" ? enterIf(lowering, next.node)
                          : next.kind === "switch" ? enterSwitch(lowering, next.node)
                            : next.kind === "switch-test" ? finishSwitchTest(lowering, next)
                            : next.kind === "switch-clause" ? nextSwitchClause(lowering, next)
                          : next.kind === "if-then-end" ? endThen(lowering, next)
                            : next.kind === "if-else-end" ? endElse(lowering, next)
                              : next.kind === "protected-end" ? endProtected(lowering, next)
                                : next.kind === "handler-end" ? endHandler(lowering, next)
                                  : next.kind === "cleanup-end" ? endCleanup(lowering, next)
                              : next.kind === "while-condition" || next.kind === "for-condition" || next.kind === "do-condition" ? loopCondition(lowering, next)
                                : next.kind === "while-end" ? endWhile(lowering, next)
                                  : next.kind === "do-end" ? endDo(lowering, next) : complete(lowering, next);
    if (!done) return false;
  }
  return true;
}

function moduleStatement(lowering: Lowering, pending: Extract<Work, { readonly kind: "module" }>): boolean {
  if (pending.position === pending.node.statements.nodes.length) return true;
  const slot = requirePresent(pending.node.statements.nodes[pending.position], failure("a module statement list has a hole", pending.node.origin));
  lowering.work.push({ ...pending, position: pending.position + 1 });
  if (slot.kind !== "ready-statement") return true;
  const node = slot.node;
  if (node.kind !== "FunctionDeclaration" && node.kind !== "ImportDeclaration" && node.kind !== "ExportDeclaration")
    lowering.work.push({ kind: "statement", node });
  return true;
}

/** Ends a body whose last block is still open, and assembles the graph. Null: refused. */
function finish(lowering: Lowering, entries: readonly number[]): MirBody | null {
  const { state, body } = lowering;
  if (state.current !== null) {
    const completion = lowering.typeOf(body.completion);
    if (completion.kind !== "intrinsic" || completion.intrinsic !== "void")
      return callerDefect("the end of a body that completes with a value is reached", body.root.origin);
    terminate(state, { ...siteOf(body, body.root), kind: "return", value: null });
  }
  if (!omittedEntries(lowering, entries)) return null;
  return finishBody(state);
}

function omittedEntries(lowering: Lowering, entries: readonly number[]): boolean {
  const { state, body } = lowering;
  const signature = lowering.signatureOf(body.signature);
  let provided = signature.parameters.length;
  let next = requirePresent(state.blocks[0], failure("a completed body has no initial block", body.root.origin)).id;
  if (entries.length === 0) return callerDefect("a selected body requires at least one offered entry", body.root.origin);
  let positionInEntries = 0;
  if (Object.is(entries[0], provided)) {
    addEntry(state, { provided, block: next });
    positionInEntries += 1;
  }
  for (let position = body.params.length - 1; position >= 0 && positionInEntries < entries.length; position -= 1) {
    const header = requirePresent(body.params[position], failure("a parameter vector has a hole", body.root.origin));
    const row = header.tsonic;
    const parameterLocal = executionParameterLocal(header, body.body);
    if (row.role === "this") continue;
    provided -= 1;
    const formal = requirePresent(signature.parameters[provided], failure("a parameter has no selected formal", header.origin));
    if (!formal.acceptsOmission) break;
    const site = siteOf(body, header);
    const entry = newBlock(state, site);
    if (entry === null) return false;
    enterBlock(state, entry);
    const local = requirePresent(lowering.localOf.get(parameterLocal.local), failure("an omitted parameter has no selected storage", header.origin));
    if (row.initializer !== null) {
      if (!initializeLocal(lowering, header, local, row.storage, row.initializer)) return false;
    } else {
      const destination = placeOfLocal(state, local);
      if (destination === null) return false;
      if (!initializeAbsence(lowering, header, destination, row.storage)) return false;
    }
    terminate(state, { ...site, kind: "goto", target: next });
    if (Object.is(entries[positionInEntries], provided)) {
      addEntry(state, { provided, block: entry });
      positionInEntries += 1;
    }
    next = entry;
  }
  return positionInEntries === entries.length || callerDefect("required entries must be unique, admissible and in decreasing provided order", body.root.origin);
}

function statement(lowering: Lowering, node: Statement<TypedPhase>): boolean {
  // No block is open after a return: what follows it in the same statement list is reached on no path.
  if (lowering.state.current === null) return true;
  switch (node.kind) {
    case "LabeledStatement": {
      const target = node.tsonic.target;
      if (target.body !== lowering.body.body) return callerDefect("a label targets another body", node.origin);
      if (lowering.labels.has(target.node)) {
        lowering.work.push({ kind: "statement", node: node.statement });
        return true;
      }
      const scope: Extract<ControlScope, { readonly kind: "label" }> = { kind: "label", node, exit: null, continuation: null,
        locals: lowering.scope, protection: lowering.protection };
      lowering.labels.set(target.node, scope);
      lowering.work.push({ kind: "label-end", node, scope }, { kind: "statement", node: node.statement });
      return true;
    }
    case "BreakStatement": return breaks(lowering, node);
    case "ContinueStatement": return continues(lowering, node);
    case "DoStatement": return enterDo(lowering, node);
    case "ForStatement": {
      const initializer = node.initializer;
      if (initializer?.kind === "MissingDeclaration") return callerDefect("a missing declaration in for initialization", node.origin);
      const headerScope = initializer?.kind === "VariableDeclarationList" && (initializer.flags.includes("Let") || initializer.flags.includes("Const"))
        ? beginLocalScope(lowering) : null;
      lowering.work.push({ kind: "for", node, headerScope });
      if (initializer?.kind === "VariableDeclarationList") return declarations(lowering, initializer);
      if (initializer !== null) lowering.work.push({ kind: "discard", node, read: null }, { kind: "expression", node: initializer });
      return true;
    }
    case "IfStatement":
      lowering.work.push({ kind: "if", node }, { kind: "expression", node: node.expression });
      return true;
    case "SwitchStatement":
      lowering.work.push({ kind: "switch", node }, { kind: "expression", node: node.expression });
      return true;
    case "WhileStatement": return enterWhile(lowering, node);
    case "EmptyStatement": case "TypeAliasDeclaration": case "InterfaceDeclaration": case "EnumDeclaration": return true;
    case "ExpressionStatement":
      lowering.work.push({ kind: "discard", node, read: null }, { kind: "expression", node: node.expression });
      return true;
    case "VariableStatement": return declarations(lowering, node.declarationList);
    case "Block": return enterLocalBlock(lowering, node);
    case "ReturnStatement":
      if (node.expression === null) return finishReturn(lowering, node, null);
      lowering.work.push({ kind: "complete", node, result: "value" }, { kind: "expression", node: node.expression });
      return true;
    case "ThrowStatement":
      lowering.work.push({ kind: "complete", node, result: "value" }, { kind: "expression", node: node.expression });
      return true;
    case "TryStatement": return enterProtected(lowering, node);
    default:
      return notLoweredYet(`the statement ${node.kind}`, node.origin);
  }
}

/** What every value node states beside its own form, including the selected conversion after its source evaluation. */
function value(lowering: Lowering, payload: TypedValue, node: NodeHeader): void {
  switch (payload.conversion.kind) {
    case "identity": break;
    case "convert":
    case "backed-convert":
      lowering.work.push({ kind: "operation", node, operation: payload.conversion.operation, form: "convert", to: payload.convertedType });
      break;
    case "deferred": return callerDefect("a deferred conversion", node.origin);
  }
  if (payload.narrowing !== null && payload.narrowing.kind === "narrowed") lowering.work.push({ kind: "narrow", node, narrowing: payload.narrowing });
  if (payload.demand.kind !== "always" && (payload.demand.kind === "never"
    || lowering.selections.get(payload.demand.control) !== payload.demand.when))
    return notLoweredYet("a value demanded under a selection", node.origin);
}

function enumOperand(lowering: Lowering, node: NodeHeader, payload: TypedValue, resolution: TirEnumResolution): boolean {
  value(lowering, payload, node);
  const storage = rawType(payload);
  const operand = constantOperand(lowering.state, storage, { kind: "constant", reference: { context: "enum-member",
    member: resolution.declaration.owner, bindings: resolution.bindings } });
  if (operand === null) return false;
  pushOperand(lowering, { kind: "plain", operand, pendingRead: false, storage, site: siteOf(lowering.body, node) });
  return true;
}

function layoutOperand(lowering: Lowering, node: NodeHeader, payload: TypedValue): boolean {
  value(lowering, payload, node);
  const storage = rawType(payload);
  const site = siteOf(lowering.body, node);
  const operand = constantOperand(lowering.state, storage, { kind: "observation", at: site.tir });
  if (operand === null) return false;
  pushOperand(lowering, { kind: "plain", operand, pendingRead: false, storage, site });
  return true;
}

function literal(lowering: Lowering, node: NodeHeader, payload: TypedValue, selected: LiteralValue): boolean {
  value(lowering, payload, node);
  if (lowering.work.at(-1)?.kind === "discard") {
    lowering.work.pop();
    return true;
  }
  return pushLiteral(lowering, node, rawType(payload), selected);
}

function pushLiteral(lowering: Lowering, node: NodeHeader, storage: TyId, selected: LiteralValue): boolean {
  const operand = constantOperand(lowering.state, storage, { kind: "literal", value: selected });
  if (operand === null) return false;
  pushOperand(lowering, { kind: "plain", operand, pendingRead: false, storage, site: siteOf(lowering.body, node) });
  return true;
}

function directStaticValue(node: Expression<TypedPhase>) {
  if (node.kind !== "Identifier" || node.tsonic.role !== "value") return null;
  const value = node.tsonic;
  const resolution = value.resolution;
  return resolution.kind === "static" && resolution.aliases.length === 0 && value.demand.kind === "always"
    && value.conversion.kind === "identity" && value.type === value.convertedType && value.narrowing === null
    ? { definition: resolution.declaration.owner, storage: value.type } : null;
}

function expression(lowering: Lowering, node: Expression<TypedPhase>): boolean {
  const { state, body } = lowering;
  switch (node.kind) {
    case "ConditionalExpression": {
      const selection = node.tsonic.selection;
      if (selection.kind !== "conditional" || selection.control !== node.condition.id
        || selection.whenTrue !== node.whenTrue.id || selection.whenFalse !== node.whenFalse.id)
        return callerDefect("a conditional selection differs from its actual operands", node.origin);
      value(lowering, node.tsonic, node);
      lowering.work.push({ kind: "conditional", node }, { kind: "expression", node: node.condition });
      return true;
    }
    case "ThisKeyword": {
      const payload = node.tsonic;
      if (payload.role !== "receiver") return callerDefect("a receiver expression without its selected receiver", node.origin);
      value(lowering, payload, node);
      const local = lowering.receiver;
      if (local === null) return notLoweredYet("a receiver without its selected receiver row", node.origin);
      const place = placeOfLocal(state, local);
      if (place === null) return false;
      pushOperand(lowering, { kind: "local-read", operand: { kind: "place", place }, root: place, local, pendingRead: true, storage: rawType(payload), site: siteOf(body, node) });
      return true;
    }
    case "TrueKeyword":
    case "FalseKeyword":
    case "NullKeyword": {
      const payload = node.tsonic;
      if (payload.role !== "value") return notLoweredYet(`a keyword literal of role ${payload.role}`, node.origin);
      return literal(lowering, node, payload, node.kind === "NullKeyword" ? { kind: "absence" }
        : { kind: "boolean", value: node.kind === "TrueKeyword" });
    }
    case "StringLiteral":
    case "NoSubstitutionTemplateLiteral": {
      const payload = node.tsonic;
      if (payload.role !== "value") return notLoweredYet(`a string literal of role ${payload.role}`, node.origin);
      return literal(lowering, node, payload, { kind: "string", value: payload.value });
    }
    case "NumericLiteral": {
      const payload = node.tsonic;
      if (payload.role !== "value") return notLoweredYet(`a numeric literal of role ${payload.role}`, node.origin);
      return literal(lowering, node, payload, { kind: "number", token: node.text, value: payload.value });
    }
    case "BigIntLiteral": {
      const payload = node.tsonic;
      if (payload.role !== "value") return notLoweredYet(`a bigint literal of role ${payload.role}`, node.origin);
      return literal(lowering, node, payload, { kind: "bigint", token: node.text, value: payload.value });
    }
    case "Identifier": {
      const payload = node.tsonic;
      if (payload.role !== "value") return notLoweredYet(`an identifier of role ${payload.role}`, node.origin);
      const resolution = payload.resolution;
      if (resolution.kind === "intrinsic-value") {
        const type = lowering.typeOf(rawType(payload));
        if (type.kind !== "intrinsic" || type.intrinsic !== "absence")
          return callerDefect("an intrinsic undefined read must retain its native absence type", node.origin);
        return literal(lowering, node, payload, { kind: "absence" });
      }
      if (resolution.kind === "enum-member") return enumOperand(lowering, node, payload, resolution);
      value(lowering, payload, node);
      if (resolution.kind === "static") {
        const site = siteOf(body, node);
        const storage = rawType(payload);
        const place = placeOfStatic(state, resolution.declaration.owner, storage, node.origin);
        if (place === null) return false;
        const saved = temporary(lowering, storage, site);
        if (saved === null || !emitStatement(state, { ...site, kind: "assign", place: saved,
          value: { kind: "use", operand: { kind: "place", place } }, step: null })) return false;
        pushOperand(lowering, held(saved, storage, site));
        return true;
      }
      if (resolution.kind === "error") return callerDefect("an error resolution", node.origin);
      if (resolution.kind !== "local") return notLoweredYet(`a name resolved to a ${resolution.kind}`, node.origin);
      const local = localFromSource(lowering, resolution.local);
      if (local === undefined) return notLoweredYet("a local that is not a parameter of the body", node.origin);
      const place = placeOfLocal(state, local);
      if (place === null) return false;
      pushOperand(lowering, { kind: "local-read", operand: { kind: "place", place }, root: place, local, pendingRead: true, storage: rawType(payload), site: siteOf(body, node) });
      return true;
    }
    case "ElementAccessExpression": {
      const payload = node.tsonic;
      if (!("index" in payload) || payload.role !== "value" || node.questionDotToken !== null)
        return notLoweredYet("an element read without its selected native index", node.origin);
      const storage = rawType(payload);
      if (payload.index.read !== storage || payload.index.write !== null || payload.index.writeCheck !== null)
        return callerDefect("an indexed read differs from its selected storage", node.origin);
      value(lowering, payload, node);
      return enterIndex(lowering, { kind: "index-receiver", node, decision: payload.index, storage, assignment: null });
    }
    case "PropertyAccessExpression": {
      const payload = node.tsonic;
      if (payload.role === "enum-member") return enumOperand(lowering, node, payload, payload.resolution);
      if (payload.role !== "value") return notLoweredYet(`a property access of role ${payload.role}`, node.origin);
      if (node.questionDotToken !== null) return notLoweredYet("a selected optional field read", node.origin);
      if (payload.selection.kind !== "decided") return callerDefect("a deferred member read", node.origin);
      const member = payload.selection.decision;
      const access = member.decision.location;
      if (access.kind !== "data") return notLoweredYet("a selected accessor invocation", node.origin);
      if (access.check.kind !== "none") return notLoweredYet("a selected checked field read", node.origin);
      const storage = rawType(payload);
      if (member.decision.read !== storage) return callerDefect("a field read inconsistent with its selected storage", node.origin);
      value(lowering, payload, node);
      const receiver = node.expression;
      const direct = access.receiver === "in-place" ? directStaticValue(receiver) : null;
      if (direct !== null) {
        const staticRoot = placeOfStatic(state, direct.definition, direct.storage, receiver.origin);
        return staticRoot !== null && fieldRead(lowering, { kind: "field-read", node, member, storage,
          receiver: { kind: "in-place", staticRoot } });
      }
      lowering.work.push({ kind: "field-read", node, member, storage, receiver: access.receiver === "in-place"
        ? { kind: "in-place", staticRoot: null } : { kind: "by-reference" } }, { kind: "expression", node: receiver });
      return true;
    }
    case "ParenthesizedExpression":
    case "NonNullExpression":
    case "AsExpression":
    case "SatisfiesExpression":
    case "TypeAssertionExpression":
      value(lowering, executingValue(node.tsonic, node.origin), node);
      lowering.work.push({ kind: "expression", node: node.expression });
      return true;
    case "BinaryExpression": {
      const payload = node.tsonic;
      if (payload.role === "assignment") return assignment(lowering, node, payload);
      if (payload.role === "short-circuit") {
        const selected = payload.selection;
        const expected = shortCircuitOperatorOf(node.operatorToken.kind, "short-circuit");
        if (selected.kind === "conditional" || selected.kind !== expected || selected.control !== node.left.id || selected.right !== node.right.id)
          return callerDefect("a short-circuit selection differs from its actual operands", node.origin);
        value(lowering, payload, node);
        lowering.work.push({ kind: "short-circuit", node }, { kind: "expression", node: node.left });
        return true;
      }
      if (payload.role === "sequence") {
        value(lowering, payload, node);
        lowering.work.push({ kind: "expression", node: node.right }, { kind: "discard", node: node.left, read: null }, { kind: "expression", node: node.left });
        return true;
      }
      value(lowering, payload, node);
      if (payload.operation.kind !== "decided") return callerDefect("a deferred operation", node.origin);
      // The operation is emitted when both operands are evaluated, the left one first.
      lowering.work.push({ kind: "operation", node, operation: payload.operation.decision, form: "binary" },
        { kind: "expression", node: node.right }, { kind: "expression", node: node.left });
      return true;
    }
    case "PrefixUnaryExpression": {
      const payload = node.tsonic;
      if (payload.role === "update") return update(lowering, node, node.operand, payload, false);
      if (payload.role !== "value") return notLoweredYet(`a prefix expression of role ${payload.role}`, node.origin);
      return unary(lowering, node, node.operand, payload);
    }
    case "PostfixUnaryExpression": return update(lowering, node, node.operand, node.tsonic, true);
    case "TypeOfExpression":
    case "VoidExpression": return unary(lowering, node, node.expression, node.tsonic);
    case "CallExpression": case "NewExpression": {
      const selected = node.tsonic;
      if (!("application" in selected)) return callerDefect("a nonexecuting declaration name in an executable call", node.origin);
      if ("layout" in selected) {
        const observation = layoutObservationOf(node);
        return observation === null ? notLoweredYet("a layout descriptor used as a runtime value", node.origin)
          : layoutOperand(lowering, node, observation);
      }
      value(lowering, selected, node);
      return enterCall(lowering, node, selected);
    }
    default:
      return notLoweredYet(`the expression ${node.kind}`, node.origin);
  }
}

function unary(lowering: Lowering, node: NodeHeader & { readonly kind: "PrefixUnaryExpression" | "TypeOfExpression" | "VoidExpression" },
  operand: Expression<TypedPhase>, payload: TypedUnary): boolean {
  value(lowering, payload, node);
  if (payload.operation.kind !== "decided") return callerDefect("a deferred operation", node.origin);
  const operation = payload.operation.decision;
  if (node.kind === "VoidExpression") {
    const { decision } = operation;
    if (decision.operation.kind !== "discard" || decision.execution.kind !== "pure")
      return callerDefect("void without its selected discard operation", node.origin);
    if (lowering.work.at(-1)?.kind !== "discard")
      lowering.work.push({ kind: "void-result", node, storage: decision.result }, { kind: "discard", node, read: null });
  } else lowering.work.push({ kind: "operation", node, operation, form: "unary" });
  lowering.work.push({ kind: "expression", node: operand });
  return true;
}

function transparentLocation(expression: Expression<TypedPhase>): Expression<TypedPhase> | null {
  while (expression.kind === "ParenthesizedExpression") {
    const selected = executingValue(expression.tsonic, expression.origin);
    if (selected.conversion.kind !== "identity" || selected.narrowing !== null) return null;
    expression = expression.expression;
  }
  return expression;
}

function assignmentTarget(expression: Expression<TypedPhase>): Expression<TypedPhase> {
  return transparentLocation(expression) ?? callerDefect("an assignment target has a value conversion or narrowing", expression.origin);
}

function update(lowering: Lowering, node: NodeHeader, operand: Expression<TypedPhase>,
  payload: TypedUnary & { readonly storage: TyId }, postfix: boolean): boolean {
  const leaf = assignmentTarget(operand);
  const target = leaf.kind === "Identifier" ? leaf.tsonic : null;
  if (target?.role !== "assignment-target" || target.access.kind !== "read-write"
    || target.access.narrowing !== null || target.access.storage !== payload.storage || target.access.read !== payload.storage
    || payload.operation.kind !== "decided") return callerDefect("an update without a selected direct read-write root", node.origin);
  let local: LocalId | null = null;
  let place: PlaceId | null;
  if (target.resolution.kind === "static" && target.resolution.aliases.length === 0) {
    place = placeOfStatic(lowering.state, target.resolution.declaration.owner, payload.storage, leaf.origin);
  } else if (target.resolution.kind === "local") {
    const placed = localFromSource(lowering, target.resolution.local);
    if (placed === undefined) return callerDefect("an update local not placed in the body", node.origin);
    local = placed;
    place = placeOfLocal(lowering.state, local);
  } else return notLoweredYet("an update without its direct local or static storage", leaf.origin);
  if (place === null) return false;
  value(lowering, payload, node);
  const site = siteOf(lowering.body, leaf);
  if (postfix || local === null) {
    const old = readPlace(lowering, place, payload.storage, site);
    if (old === null) return false;
    if (postfix) pushOperand(lowering, { ...old, site: siteOf(lowering.body, node) });
    pushOperand(lowering, old);
  } else pushOperand(lowering, { kind: "local-read", operand: { kind: "place", place }, root: place, local, storage: payload.storage, pendingRead: true, site });
  lowering.work.push({ kind: "store", node, local, place, result: postfix ? "old" : "new", checked: null, storageRoot: place },
    { kind: "operation", node, operation: payload.operation.decision, form: "unary" });
  return true;
}

function assignment(lowering: Lowering, node: BinaryExpression<TypedPhase>, payload: Extract<TypedBinary, { readonly role: "assignment" }>): boolean {
  const logical = shortCircuitOperatorOf(node.operatorToken.kind, "assignment");
  const selection = payload.selection;
  if (selection === null ? logical !== null : selection.kind === "conditional" || selection.kind !== logical
    || selection.control !== node.left.id || selection.right !== node.right.id || payload.calculation !== null)
    return callerDefect("a conditional assignment differs from its actual selected control", node.origin);
  const target = assignmentTarget(node.left);
  if (target.kind !== "Identifier" && target.kind !== "PropertyAccessExpression" && target.kind !== "ElementAccessExpression")
    return notLoweredYet(`an assignment target of kind ${target.kind}`, target.origin);
  const selected = target.tsonic;
  if (selected.role !== "assignment-target") return callerDefect("an assignment without a selected target", target.origin);
  if (selected.access.storage !== payload.storage) return callerDefect("an assignment with inconsistent selected storage", target.origin);
  const calculated = payload.calculation;
  if (calculated !== null && calculated.kind !== "decided") return callerDefect("a deferred assignment operation", node.origin);
  const calculation = calculated === null ? null : calculated.decision;
  if ((calculation !== null || selection !== null) && selected.access.kind !== "read-write")
    return callerDefect(selection === null ? "a calculated assignment without a selected read" : "a conditional assignment without a selected read", target.origin);
  if (selected.access.kind === "read-write" && selected.access.narrowing !== null) return notLoweredYet("a narrowed assignment read", target.origin);
  const read = selected.access.kind === "read-write" ? selected.access.read : selected.access.storage;
  if (target.kind === "ElementAccessExpression") {
    if (!("index" in selected) || target.questionDotToken !== null) return notLoweredYet("an element assignment without its selected native index", target.origin);
    const { index } = selected;
    if (index.write !== payload.storage || index.read !== (selected.access.kind === "write" ? null : read) || index.writeCheck === null)
      return callerDefect("an index assignment differs from its actual selected access", target.origin);
    return enterIndex(lowering, { kind: "index-receiver", node: target, decision: index, storage: payload.storage, assignment: node });
  }
  if (target.kind === "PropertyAccessExpression") {
    if (!("selection" in selected) || selected.selection.kind !== "decided")
      return callerDefect("a field assignment requires its actual selected member", target.origin);
    const member = selected.selection.decision;
    const location = member.decision.location;
    if (target.questionDotToken !== null || location.kind !== "data" || location.check.kind !== "none"
      || member.getter !== null || member.setter !== null)
      return notLoweredYet("a field assignment without a selected direct storage location", target.origin);
    if (member.decision.write !== selected.access.storage || selected.access.kind === "read-write" && member.decision.read !== read)
      return callerDefect("a field assignment differs from its actual selected field type", target.origin);
    const direct = location.receiver === "in-place" ? directStaticValue(target.expression) : null;
    const staticRoot = direct === null ? null : placeOfStatic(lowering.state, direct.definition, direct.storage, target.expression.origin);
    if (direct !== null && staticRoot === null) return false;
    const pending: Extract<Work, { readonly kind: "field-assignment" }> = { kind: "field-assignment", node, target, member,
      storage: selected.access.storage, read, value: payload, conditional: selection !== null, calculation,
      receiver: location.receiver === "in-place" ? { kind: "in-place", staticRoot } : { kind: "by-reference" } };
    if (staticRoot !== null) return fieldAssignment(lowering, pending);
    lowering.work.push(pending, { kind: "expression", node: target.expression });
    return true;
  }
  if (!("resolution" in selected)) return callerDefect("a name assignment requires its selected resolution", target.origin);
  if (selected.resolution.kind === "error") return callerDefect("an error resolution", target.origin);
  let local: LocalId | null = null;
  let place: PlaceId | null;
  if (selected.resolution.kind === "static") {
    if (selection !== null || selected.resolution.aliases.length !== 0 || (selected.access.kind === "write") !== (payload.calculation === null))
      return notLoweredYet("a static assignment without its direct selected access", target.origin);
    place = placeOfStatic(lowering.state, selected.resolution.declaration.owner, selected.access.storage, target.origin);
  } else if (selected.resolution.kind === "local") {
    const placed = localFromSource(lowering, selected.resolution.local);
    if (placed === undefined) return notLoweredYet("an assignment to a local not placed in the body", target.origin);
    local = placed;
    place = placeOfLocal(lowering.state, placed);
  } else return notLoweredYet(`an assignment resolved to a ${selected.resolution.kind}`, target.origin);
  if (place === null) return false;
  return scheduleAssignment(lowering, node, target, place, local, payload, read, calculation, selection !== null);
}

function scheduleAssignment(lowering: Lowering, node: BinaryExpression<TypedPhase>, target: NodeHeader, place: PlaceId, local: LocalId | null,
  payload: TypedValue, read: TyId, calculation: TypedOperation | null, conditional: boolean, checked: CheckedWrite | null = null, storageRoot: PlaceId = place): boolean {
  value(lowering, payload, node);
  const write: Extract<Work, { readonly kind: "store" }> = { kind: "store", node, local, place, result: "new", checked, storageRoot };
  if (calculation !== null || conditional) {
    const actual = readPlace(lowering, place, read, siteOf(lowering.body, target));
    if (actual === null) return false;
    pushOperand(lowering, actual);
    if (conditional) return enterShortCircuit(lowering, node, write);
  }
  lowering.work.push(write);
  if (calculation !== null) {
    lowering.work.push({ kind: "operation", node, operation: calculation, form: "binary" });
  }
  lowering.work.push({ kind: "expression", node: node.right });
  return true;
}

function store(lowering: Lowering, pending: Extract<Work, { readonly kind: "store" }>): boolean {
  let right = popOperand(lowering, failure("an assignment completed without its value", pending.node.origin));
  let discard = false;
  if (pending.result === "new" && right.kind === "shared-field") {
    discard = lowering.work.at(-1)?.kind === "discard";
    if (!discard) {
      const saved = saveRead(lowering, right);
      if (saved === null) return false;
      right = saved;
    }
  }
  const checked = pending.checked;
  if (checked !== null) {
    if (checked.stamp === null || !placeCheckAvailable(lowering.state, checked.stamp)) {
      if (right.pendingRead && right.operand.kind === "place") {
        const saved = right.anchor === undefined ? readPlace(lowering, right.operand.place, right.storage, right.site) : saveRead(lowering, right);
        if (saved === null) return false;
        right = saved;
      }
      if (!emitPlaceCheck(lowering, checked.target, checked.place, checked.failure, pending.node)) return false;
    }
    if (!saveBeforeControl(lowering, true, true)) return false;
  }
  if (!saveBeforeStore(lowering, pending.storageRoot, pending.local)) return false;
  if (!emitStatement(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "assign", place: pending.place,
    value: { kind: "use", operand: right.operand }, step: null })) return false;
  if (discard) lowering.work.pop();
  else if (pending.result === "new") {
    const result: {
      readonly storage: TyId; readonly pendingRead: false; readonly site: ReturnType<typeof siteOf>;
    } = { storage: right.storage, pendingRead: false, site: siteOf(lowering.body, pending.node) };
    pushOperand(lowering, right.kind === "local-read"
      ? { ...result, kind: "local-read", operand: right.operand, root: right.root, local: right.local }
      : { ...result, kind: "plain", operand: right.operand });
  }
  return true;
}

function operation(lowering: Lowering, pendingOperation: Extract<Work, { readonly kind: "operation" }>): boolean {
  const { node, operation: selected } = pendingOperation;
  const { state, body } = lowering;
  // An operation is pushed below its operands, so they are on the operand stack when it is reached.
  const right = popOperand(lowering, failure("an operation was reached without its final operand", node.origin));
  const left = pendingOperation.form === "binary" ? popOperand(lowering, failure("an operation was reached without its left operand", node.origin)) : null;
  const site = siteOf(body, node);
  const execution = selected.decision.execution;
  if (execution.kind === "pure") {
    const result = temporary(lowering, selected.decision.result, site);
    if (result === null) return false;
    if (!emitStatement(state, { ...site, kind: "assign", place: result,
      value: pendingOperation.form === "convert" ? { kind: "convert", operation: selected, operand: right.operand, to: pendingOperation.to }
        : left === null ? { kind: "unary", operation: selected, operand: right.operand }
        : { kind: "binary", operation: selected, left: left.operand, right: right.operand }, step: null })) return false;
    pushOperand(lowering, held(result, selected.decision.result, site));
    return true;
  }
  if (!saveBeforeControl(lowering, execution.writesStorage, execution.failure !== "none")) return false;
  const result = temporary(lowering, selected.decision.result, site);
  if (result === null) return false;
  // The block the control point continues to starts the evaluation of whatever is pending next.
  // A value is always pushed above the work that consumes it, so that work is pending.
  const pending = requirePresent(lowering.work.at(-1), failure("a value was evaluated with nothing to consume it", node.origin));
  const next = newBlock(state, siteOf(body, workNode(pending)));
  if (next === null) return false;
  const unwind: MirUnwind | null = execution.failure === "none" ? { kind: "none" }
    : execution.failure === "abort" ? { kind: "abort" } : unwindToHandler(lowering, node);
  if (unwind === null) return false;
  terminate(state, { ...site, kind: "invoke", operation: selected, operands: left === null ? [right.operand] : [left.operand, right.operand],
    destination: result, next, unwind, step: null });
  enterBlock(state, next);
  pushOperand(lowering, held(result, selected.decision.result, site));
  return true;
}

function narrow(lowering: Lowering, node: NodeHeader, decision: Extract<NonNullable<TypedValue["narrowing"]>, { readonly kind: "narrowed" }>): boolean {
  let raw = popOperand(lowering, failure("a narrowing was reached without its value", node.origin));
  const { state, body } = lowering;
  const site = siteOf(body, node);
  const consumer = lowering.work.at(-1);
  if (raw.kind === "shared-field" && consumer?.kind !== "discard") {
    const saved = saveRead(lowering, raw);
    if (saved === null) return false;
    raw = saved;
  }
  if (!saveBeforeControl(lowering, false, true)) return false;
  let parent: PlaceId;
  if (raw.operand.kind === "place") parent = raw.operand.place;
  else {
    const saved = temporary(lowering, raw.storage, site);
    if (saved === null) return false;
    if (!emitStatement(state, { ...site, kind: "assign", place: saved, value: { kind: "use", operand: raw.operand }, step: null })) return false;
    parent = saved;
  }
  const checked = newPlace(state, { kind: "checked", place: parent, projection: { kind: "refined" }, tir: site.tir }, decision.result, node.origin);
  if (checked === null) return false;
  const pending = requirePresent(consumer, failure("a narrowed value was evaluated with nothing to consume it", node.origin));
  const next = newBlock(state, siteOf(body, workNode(pending)));
  if (next === null) return false;
  const unwind: MirUnwind | null = decision.failure === "abort" ? { kind: "abort" } : unwindToHandler(lowering, node);
  if (unwind === null) return false;
  terminate(state, { ...site, kind: "check", place: checked, next, unwind });
  enterBlock(state, next);
  const refined = { operand: { kind: "place", place: checked } satisfies MirOperand, pendingRead: false, storage: decision.result, site };
  pushOperand(lowering, raw.kind === "local-read"
    ? { ...refined, kind: "local-read", root: raw.root, local: raw.local }
    : { ...refined, kind: "plain" });
  return true;
}

function fieldPlace(lowering: Lowering, node: NodeHeader, member: Extract<Work, { readonly kind: "field-read" }>["member"], storage: TyId,
  receiver: FieldReceiver, access: "read" | "write"): { readonly place: PlaceId; readonly base: PlaceId; readonly source: Evaluated | null } | null {
  const staticRoot = receiver.kind === "in-place" ? receiver.staticRoot : null;
  let source: Evaluated | null = null;
  let base: PlaceId;
  if (receiver.kind === "by-reference") {
    const value = popOperand(lowering, failure("a field access was reached without its receiver", node.origin));
    const holder = holdReceiver(lowering, value);
    if (holder === null) return null;
    base = holder;
  } else if (staticRoot !== null) base = staticRoot;
  else {
    source = popOperand(lowering, failure("a field access was reached without its receiver", node.origin));
    if (source.kind === "shared-field" && access === "read") {
      source = saveRead(lowering, source);
      if (source === null) return null;
    }
    if (source.operand.kind !== "place") return callerDefect("an in-place field read requires an evaluated storage place", node.origin);
    base = source.operand.place;
  }
  const site = siteOf(lowering.body, node);
  const place = newPlace(lowering.state,
    { kind: "place", place: base, projection: { kind: "field", member }, tir: site.tir }, storage, node.origin);
  return place === null ? null : { place, base, source };
}

function fieldAssignment(lowering: Lowering, pending: Extract<Work, { readonly kind: "field-assignment" }>): boolean {
  const { state } = lowering;
  const selected = fieldPlace(lowering, pending.target, pending.member, pending.storage, pending.receiver, "write");
  if (selected === null) return false;
  let local: LocalId | null = null;
  let checked: CheckedWrite | null = null;
  let storageRoot = selected.place;
  if (pending.receiver.kind === "in-place") {
    const parent = state.places[selected.base]?.base;
    if (parent?.kind === "local" || parent?.kind === "static") {
      storageRoot = selected.base;
      local = parent.kind === "local" ? parent.local : null;
    } else if (parent?.kind === "checked" && parent.projection.kind === "refined") {
      const root = state.places[parent.place]?.base;
      const target = transparentLocation(pending.target.expression);
      const payload = target?.kind === "NonNullExpression" ? executingValue(target.tsonic, target.origin) : null;
      if (root?.kind !== "local" || target === null || parent.tir.node !== target.id || payload?.narrowing?.kind !== "narrowed")
        return notLoweredYet("an in-place field assignment without its directly narrowed local", pending.target.origin);
      local = root.local;
      storageRoot = parent.place;
      checked = { target, place: selected.base, failure: payload.narrowing.failure,
        stamp: placeCheckStamp(state, lowering.preservedLocals, local, "mutable-storage") };
    } else return notLoweredYet("an in-place field assignment through enclosing projections", pending.target.origin);
  }
  return scheduleAssignment(lowering, pending.node, pending.target, selected.place, local,
    pending.value, pending.read, pending.calculation, pending.conditional, checked, storageRoot);
}

function fieldRead(lowering: Lowering, { node, member, storage, receiver }: Extract<Work, { readonly kind: "field-read" }>): boolean {
  const selected = fieldPlace(lowering, node, member, storage, receiver, "read");
  if (selected === null) return false;
  const { place, base, source } = selected;
  const result = { operand: { kind: "place", place } satisfies MirOperand, pendingRead: true, storage, site: siteOf(lowering.body, node) };
  pushOperand(lowering, receiver.kind === "by-reference" || receiver.staticRoot !== null ? { ...result, kind: "shared-field", root: base }
    : source?.kind === "local-read" ? { ...result, kind: "local-read", root: source.root, local: source.local }
      : { ...result, kind: "plain" });
  return true;
}

function emitPlaceCheck(lowering: Lowering, node: NodeHeader, place: PlaceId, selectedFailure: CheckFailure, continuation: NodeHeader): boolean {
  if (!saveBeforeControl(lowering, false, true)) return false;
  const { body, state } = lowering;
  const next = newBlock(state, siteOf(body, continuation));
  if (next === null) return false;
  const unwind: MirUnwind | null = selectedFailure === "abort" ? { kind: "abort" } : unwindToHandler(lowering, node);
  if (unwind === null) return false;
  terminate(state, { ...siteOf(body, node), kind: "check", place, next, unwind });
  enterBlock(state, next);
  return true;
}

function enterIndex(lowering: Lowering, pending: Extract<Work, { readonly kind: "index-receiver" }>): boolean {
  const { node, decision } = pending;
  if (decision.holding === "in-place") {
    const receiver = transparentLocation(node.expression);
    if (receiver?.kind === "Identifier" && receiver.tsonic.role === "value" && receiver.tsonic.resolution.kind === "static") {
      const direct = directStaticValue(receiver);
      if (direct === null || direct.storage !== decision.receiver)
        return notLoweredYet("an in-place index without its actual static place", receiver.origin);
      const base = placeOfStatic(lowering.state, direct.definition, direct.storage, receiver.origin);
      return base !== null && enterIndexKey(lowering, pending, base);
    }
  }
  lowering.work.push(pending, { kind: "expression", node: node.expression });
  return true;
}

function enterIndexKey(lowering: Lowering, pending: Extract<Work, { readonly kind: "index-receiver" }>, base: PlaceId): boolean {
  lowering.work.push({ ...pending, kind: "index-key", base }, { kind: "expression", node: pending.node.argumentExpression });
  return true;
}

function indexReceiver(lowering: Lowering, pending: Extract<Work, { readonly kind: "index-receiver" }>): boolean {
  const { node, decision } = pending;
  const actual = popOperand(lowering, failure("an index completed without its evaluated receiver", node.origin));
  if (actual.storage !== decision.receiver) return callerDefect("an index receiver differs from its selected storage", node.origin);
  let base: PlaceId | null;
  if (decision.holding === "by-reference") base = holdReceiver(lowering, actual);
  else {
    if (actual.operand.kind !== "place") return callerDefect("an in-place index requires its actual storage", node.origin);
    const storage = lowering.state.places[actual.operand.place]?.base;
    if (storage?.kind !== "local" && storage?.kind !== "static")
      return notLoweredYet("an in-place index with enclosing projected storage", node.origin);
    base = actual.operand.place;
  }
  return base !== null && enterIndexKey(lowering, pending, base);
}

function indexKey(lowering: Lowering, { node, decision, assignment, storage, base }: Extract<Work, { readonly kind: "index-key" }>): boolean {
  const { body, state } = lowering;
  const actual = popOperand(lowering, failure("an index completed without its evaluated key", node.origin));
  if (actual.storage !== decision.key) return callerDefect("an index key differs from its selected operand", node.origin);
  let operand: MirOperand = actual.operand;
  if (operand.kind === "place") {
    const held = holdReceiver(lowering, actual);
    if (held === null) return false;
    operand = { kind: "place", place: held };
  }
  const site = siteOf(body, node);
  const place = newPlace(state, { kind: "checked", place: base, projection: { kind: "index", operand }, tir: site.tir }, storage, node.origin);
  if (place === null) return false;
  if (assignment === null) {
    const consumer = requirePresent(lowering.work.at(-1), failure("an indexed read has no executing consumer", node.origin));
    if (!emitPlaceCheck(lowering, node, place, decision.failure, workNode(consumer))) return false;
    const payload = { pendingRead: true, operand: { kind: "place", place } satisfies MirOperand, storage, site };
    const backing = state.places[base]?.base;
    pushOperand(lowering, decision.holding === "in-place" && backing?.kind === "local"
      ? { ...payload, kind: "local-read", root: base, local: backing.local } : { ...payload, kind: "shared-field", root: base });
    return true;
  }
  const payload = assignment.tsonic;
  if (payload.role !== "assignment" || payload.calculation?.kind === "deferred")
    return callerDefect("an index store has no actual selected assignment", assignment.origin);
  const early = decision.read !== null || decision.writeCheck === "before-value";
  if (early && !emitPlaceCheck(lowering, node, place, decision.failure, assignment.right)) return false;
  const backing = state.places[base]?.base;
  const local = backing?.kind === "local" ? backing.local : null;
  const stamp = early ? placeCheckStamp(state, lowering.preservedLocals, local,
    decision.carrier === "fixed-array" ? "fixed-local-extent" : "mutable-storage") : null;
  return scheduleAssignment(lowering, assignment, node, place, decision.holding === "in-place" ? local : null, payload, decision.read ?? storage,
    payload.calculation?.decision ?? null, payload.selection !== null, { target: node, place, failure: decision.failure, stamp },
    decision.holding === "in-place" ? base : place);
}

function discard(lowering: Lowering, pending: Discard): boolean {
  return observePendingRead(lowering, popOperand(lowering, failure("an expression completed without its value", pending.node.origin)), pending.read);
}

function complete(lowering: Lowering, { node, result: transport }: Extract<Work, { readonly kind: "complete" }>): boolean {
  if (transport === "void") return finishReturn(lowering, node, null);
  const result = popOperand(lowering, failure("a completion was reached without its value", node.origin));
  const site = siteOf(lowering.body, node);
  if (node.kind === "ThrowStatement") {
    const unwind = unwindToHandler(lowering, node);
    if (unwind === null) return false;
    terminate(lowering.state, { ...site, kind: "throw", operand: result.operand, unwind });
  } else return finishReturn(lowering, node, result);
  return true;
}

function finishReturn(lowering: Lowering, node: NodeHeader, result: Evaluated | null): boolean {
  let cleanup = lowering.protection;
  while (cleanup !== null && cleanup.cleanup === null) cleanup = cleanup.outer;
  if (cleanup !== null) {
    const heldResult = result?.pendingRead !== true ? result : result.kind === "plain"
      ? readPlace(lowering, result.operand.place, result.storage, result.site) : saveRead(lowering, result);
    if (result !== null && heldResult === null) return false;
    if (!leaveProtectedScopes(lowering, null, null, node, "control")) return false;
    result = heldResult;
  }
  terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "return", value: result?.operand ?? null });
  return true;
}
