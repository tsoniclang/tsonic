import type { Diagnostic, Result } from "../diag/contract.js";
import { requirePresent, resourceLimitDiagnostic } from "../diag/index.js";
import type { BodyId, LocalId, PlaceId } from "../ids/contract.js";
import type { BinaryExpression, Expression, NodeHeader, ReturnStatement, Statement, ThrowStatement } from "../ir-hir/contract.js";
import type { MirBody, MirLocalRole, MirUnwind } from "../ir-mir/contract.js";
import { localOwnershipOfMir } from "../ir-mir/index.js";
import type { TirBody, TirLocal, TypedBinary, TypedPhase, TypedUnary, TypedValue } from "../ir-tir/contract.js";
import type { LiteralValue } from "../ir-types/contract.js";
import type { InternalBodyInput, LowerMirDeps } from "./contract.js";
import type { ControlScope, Lowering, Work } from "./model.js";
import { callerDefect, failure, notLoweredYet, rawType, siteOf } from "./model.js";
import { held, popOperand, pushOperand, saveHandedOut, saveReads, temporary } from "./operands.js";
import { breaks, continues, endConditionalFalse, endConditionalTrue, endDo, endElse, endFor, endLabel, endSelected, endShortCircuit, endThen, endWhile, enterConditional, enterDo, enterFor, enterIf, enterShortCircuit, enterWhile, loopCondition, nextFor } from "./control.js";
import { argumentPlace, enterCall, finishCall } from "./calls.js";
import { declareLocal, declarations, endLocalBlock, enterLocalBlock, initializeLocal, nextDeclaration, prepareFunctionLocals } from "./bindings.js";
import { addEntry, constantOperand, createState, emitStatement, enterBlock, finishBody, newBlock, newLocal, newPlace, placeOfLocal, terminate } from "./state.js";

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
export function lowerBody(deps: LowerMirDeps, body: TirBody, internal: readonly InternalBodyInput[]): Result<MirBody> {
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
    exposed: new Set(), reads: new Map(), branches: [], selections: new Map(), localOf: new Map(), labels: new Map(), preservedLocals: new Set(), receiver: null,
    outerLocals: new Map(), scope: null };
  const mir = enter(lowering, root) && walk(lowering) ? finish(deps, lowering) : null;
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
    if (row.local === null || row.passing === null || row.local.body !== body.body)
      return callerDefect("a parameter requires its actual executing body local and passing", header.origin);
    if (row.role === "rest") return notLoweredYet("a parameter of role rest", root.origin);
    if (header.initializer !== null && row.initializer === null)
      return notLoweredYet("a parameter initializer without its placed execution", header.origin);
    if (row.role === "this" && lowering.receiver !== null) return callerDefect("two selected receiver parameter rows", root.origin);
    const role: MirLocalRole = row.role === "this" ? { kind: "receiver" } : { kind: "parameter", index: parameters };
    const local = newLocal(state, row.storage, role, row.passing,
      row.local, header.origin);
    if (local === null) return false;
    if (row.role !== "this") parameters += 1;
    else lowering.receiver = local;
    lowering.localOf.set(row.local.local, local);
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
  addEntry(state, { provided: parameters, block: first });
  if (root.kind === "SourceFile") lowering.work.push({ kind: "module", node: root, position: 0 });
  else if (root.kind === "Block") lowering.work.push({ kind: "statement", node: root });
  else lowering.work.push({ kind: "complete", node: root }, { kind: "expression", node: root });
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
          : next.kind === "short-circuit" ? enterShortCircuit(lowering, next.node)
            : next.kind === "short-circuit-end" ? endShortCircuit(lowering, next)
          : next.kind === "conditional-true" ? endConditionalTrue(lowering, next)
            : next.kind === "conditional-false" ? endConditionalFalse(lowering, next)
              : next.kind === "selected-end" ? endSelected(lowering, next.node)
        : next.kind === "declaration" ? declareLocal(lowering, next.node, next.lexical)
          : next.kind === "declarations" ? nextDeclaration(lowering, next)
          : next.kind === "block-end" ? endLocalBlock(lowering, next.node, next.scope)
        : next.kind === "argument-place" ? argumentPlace(lowering, next.node)
        : next.kind === "call" ? finishCall(lowering, next)
        : next.kind === "operation" ? operation(lowering, next)
          : next.kind === "narrow" ? narrow(lowering, next.node, next.narrowing)
            : next.kind === "label-end" ? endLabel(lowering, next.node, next.scope)
              : next.kind === "for" ? enterFor(lowering, next.node)
                : next.kind === "for-end" ? endFor(lowering, next)
                  : next.kind === "for-next" ? nextFor(lowering, next)
                    : next.kind === "discard" ? discard(lowering, next.node)
                      : next.kind === "store" ? store(lowering, next)
                        : next.kind === "if" ? enterIf(lowering, next.node)
                          : next.kind === "if-then-end" ? endThen(lowering, next)
                            : next.kind === "if-else-end" ? endElse(lowering, next)
                              : next.kind === "while-condition" || next.kind === "for-condition" || next.kind === "do-condition" ? loopCondition(lowering, next)
                                : next.kind === "while-end" ? endWhile(lowering, next)
                                  : next.kind === "do-end" ? endDo(lowering, next) : complete(lowering, next.node);
    if (!done) return false;
  }
  return true;
}

function moduleStatement(lowering: Lowering, pending: Extract<Work, { readonly kind: "module" }>): boolean {
  if (pending.position === pending.node.statements.nodes.length) return true;
  const node = requirePresent(pending.node.statements.nodes[pending.position], failure("a module statement list has a hole", pending.node.origin));
  lowering.work.push({ ...pending, position: pending.position + 1 });
  if (node.kind !== "FunctionDeclaration" && node.kind !== "ImportDeclaration" && node.kind !== "ExportDeclaration")
    lowering.work.push({ kind: "statement", node });
  return true;
}

/** Ends a body whose last block is still open, and assembles the graph. Null: refused. */
function finish(deps: LowerMirDeps, lowering: Lowering): MirBody | null {
  const { state, body } = lowering;
  if (state.current !== null) {
    const completion = deps.typeOf(body.completion);
    if (completion.kind !== "intrinsic" || completion.intrinsic !== "void")
      return callerDefect("the end of a body that completes with a value is reached", body.root.origin);
    terminate(state, { ...siteOf(body, body.root), kind: "return", value: null });
  }
  if (!omittedEntries(lowering)) return null;
  return finishBody(state);
}

function omittedEntries(lowering: Lowering): boolean {
  const { state, body } = lowering;
  const signature = lowering.signatureOf(body.signature);
  let provided = signature.parameters.length;
  let next = requirePresent(state.entries[0], failure("a completed body has no full entry", body.root.origin)).block;
  for (let position = body.params.length - 1; position >= 0; position -= 1) {
    const header = requirePresent(body.params[position], failure("a parameter vector has a hole", body.root.origin));
    const row = header.tsonic;
    if (row.local === null) return callerDefect("an execution parameter requires its actual body local", header.origin);
    if (row.role === "this") continue;
    provided -= 1;
    const formal = requirePresent(signature.parameters[provided], failure("a parameter has no selected formal", header.origin));
    if (!formal.acceptsOmission) break;
    const site = siteOf(body, header);
    const entry = newBlock(state, site);
    if (entry === null) return false;
    enterBlock(state, entry);
    const local = requirePresent(lowering.localOf.get(row.local.local), failure("an omitted parameter has no selected storage", header.origin));
    if (row.initializer !== null) {
      if (!initializeLocal(lowering, header, local, row.storage, row.initializer)) return false;
    } else {
      const destination = placeOfLocal(state, local);
      if (destination === null) return false;
      const absence = constantOperand(state, row.storage, { kind: "literal", value: { kind: "absence" } });
      if (absence === null) return false;
      if (!emitStatement(state, { ...site, kind: "assign", place: destination, value: { kind: "use", operand: absence }, step: null })) return false;
    }
    terminate(state, { ...site, kind: "goto", target: next });
    addEntry(state, { provided, block: entry });
    next = entry;
  }
  return true;
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
      const scope: Extract<ControlScope, { readonly kind: "label" }> = { kind: "label", node, exit: null, continuation: null, locals: lowering.scope };
      lowering.labels.set(target.node, scope);
      lowering.work.push({ kind: "label-end", node, scope }, { kind: "statement", node: node.statement });
      return true;
    }
    case "BreakStatement": return breaks(lowering, node);
    case "ContinueStatement": return continues(lowering, node);
    case "DoStatement": return enterDo(lowering, node);
    case "ForStatement":
      if (node.initializer !== null && node.initializer.kind === "MissingDeclaration") return callerDefect("a missing declaration in for initialization", node.origin);
      if (node.initializer?.kind === "VariableDeclarationList"
        && (node.initializer.flags.includes("Let") || node.initializer.flags.includes("Const")))
        return notLoweredYet("for initialization by declarations", node.origin);
      lowering.work.push({ kind: "for", node });
      if (node.initializer?.kind === "VariableDeclarationList") return declarations(lowering, node.initializer);
      if (node.initializer !== null) lowering.work.push({ kind: "discard", node }, { kind: "expression", node: node.initializer });
      return true;
    case "IfStatement":
      lowering.work.push({ kind: "if", node }, { kind: "expression", node: node.expression });
      return true;
    case "WhileStatement": return enterWhile(lowering, node);
    case "EmptyStatement": return true;
    case "ExpressionStatement":
      lowering.work.push({ kind: "discard", node }, { kind: "expression", node: node.expression });
      return true;
    case "VariableStatement": return declarations(lowering, node.declarationList);
    case "Block": return enterLocalBlock(lowering, node);
    case "ReturnStatement":
      if (node.expression === null) {
        terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "return", value: null });
        return true;
      }
      lowering.work.push({ kind: "complete", node }, { kind: "expression", node: node.expression });
      return true;
    case "ThrowStatement":
      lowering.work.push({ kind: "complete", node }, { kind: "expression", node: node.expression });
      return true;
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

function literal(lowering: Lowering, node: NodeHeader, payload: TypedValue, selected: LiteralValue): boolean {
  value(lowering, payload, node);
  const storage = rawType(payload);
  const operand = constantOperand(lowering.state, storage, { kind: "literal", value: selected });
  if (operand === null) return false;
  pushOperand(lowering, { operand, inPlace: null, storage, site: siteOf(lowering.body, node) });
  return true;
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
      pushOperand(lowering, { operand: { kind: "place", place }, inPlace: local, storage: rawType(payload), site: siteOf(body, node) });
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
      value(lowering, payload, node);
      const resolution = payload.resolution;
      if (resolution.kind === "error") return callerDefect("an error resolution", node.origin);
      if (resolution.kind !== "local") return notLoweredYet(`a name resolved to a ${resolution.kind}`, node.origin);
      const local = resolution.local.body === body.body ? lowering.localOf.get(resolution.local.local) : undefined;
      if (local === undefined) return notLoweredYet("a local that is not a parameter of the body", node.origin);
      const place = placeOfLocal(state, local);
      if (place === null) return false;
      pushOperand(lowering, { operand: { kind: "place", place }, inPlace: local, storage: rawType(payload), site: siteOf(body, node) });
      return true;
    }
    case "ParenthesizedExpression":
    case "NonNullExpression":
    case "AsExpression":
    case "SatisfiesExpression":
    case "TypeAssertionExpression":
      value(lowering, node.tsonic, node);
      lowering.work.push({ kind: "expression", node: node.expression });
      return true;
    case "BinaryExpression": {
      const payload = node.tsonic;
      if (payload.role === "assignment") return assignment(lowering, node, payload);
      if (payload.role === "short-circuit") {
        const selected = payload.selection;
        const expected = node.operatorToken.kind === "AmpersandAmpersandToken" ? "and"
          : node.operatorToken.kind === "BarBarToken" ? "or" : node.operatorToken.kind === "QuestionQuestionToken" ? "coalesce" : null;
        if (selected.kind === "conditional" || selected.kind !== expected || selected.control !== node.left.id || selected.right !== node.right.id)
          return callerDefect("a short-circuit selection differs from its actual operands", node.origin);
        value(lowering, payload, node);
        lowering.work.push({ kind: "short-circuit", node }, { kind: "expression", node: node.left });
        return true;
      }
      if (payload.role === "sequence") {
        value(lowering, payload, node);
        lowering.work.push({ kind: "expression", node: node.right }, { kind: "discard", node: node.left }, { kind: "expression", node: node.left });
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
      if (payload.role !== "value") return notLoweredYet(`a prefix expression of role ${payload.role}`, node.origin);
      return unary(lowering, node, node.operand, payload);
    }
    case "TypeOfExpression":
    case "VoidExpression": return unary(lowering, node, node.expression, node.tsonic);
    case "CallExpression": case "NewExpression":
      value(lowering, node.tsonic, node);
      return enterCall(lowering, node);
    default:
      return notLoweredYet(`the expression ${node.kind}`, node.origin);
  }
}

function unary(lowering: Lowering, node: NodeHeader, operand: Expression<TypedPhase>, payload: TypedUnary): boolean {
  value(lowering, payload, node);
  if (payload.operation.kind !== "decided") return callerDefect("a deferred operation", node.origin);
  lowering.work.push({ kind: "operation", node, operation: payload.operation.decision, form: "unary" }, { kind: "expression", node: operand });
  return true;
}

function assignment(lowering: Lowering, node: BinaryExpression<TypedPhase>, payload: Extract<TypedBinary, { readonly role: "assignment" }>): boolean {
  if (payload.selection !== null) return notLoweredYet("a conditional assignment", node.origin);
  let target = node.left;
  while (target.kind === "ParenthesizedExpression") {
    if (target.tsonic.conversion.kind !== "identity" || target.tsonic.narrowing !== null)
      return callerDefect("an assignment target has a value conversion or narrowing", target.origin);
    target = target.expression;
  }
  if (target.kind !== "Identifier") return notLoweredYet(`an assignment target of kind ${target.kind}`, target.origin);
  const selected = target.tsonic;
  if (selected.role !== "assignment-target") return callerDefect("an assignment without a selected target", target.origin);
  if (selected.resolution.kind === "error") return callerDefect("an error resolution", target.origin);
  if (selected.resolution.kind !== "local") return notLoweredYet(`an assignment resolved to a ${selected.resolution.kind}`, target.origin);
  const local = selected.resolution.local.body === lowering.body.body ? lowering.localOf.get(selected.resolution.local.local) : undefined;
  if (local === undefined) return notLoweredYet("an assignment to a local not placed in the body", target.origin);
  if (selected.access.storage !== payload.storage) return callerDefect("an assignment with inconsistent selected storage", target.origin);
  if (payload.calculation !== null && payload.calculation.kind !== "decided") return callerDefect("a deferred assignment operation", node.origin);
  if (payload.calculation !== null && selected.access.kind !== "read-write") return callerDefect("a calculated assignment without a selected read", target.origin);
  if (selected.access.kind === "read-write" && selected.access.narrowing !== null) return notLoweredYet("a narrowed assignment read", target.origin);
  const read = selected.access.kind === "read-write" ? selected.access.read : selected.access.storage;
  value(lowering, payload, node);
  const place = placeOfLocal(lowering.state, local);
  if (place === null) return false;
  lowering.work.push({ kind: "store", node, local, place });
  if (payload.calculation !== null) {
    pushOperand(lowering, { operand: { kind: "place", place }, inPlace: local,
      storage: read, site: siteOf(lowering.body, target) });
    lowering.work.push({ kind: "operation", node, operation: payload.calculation.decision, form: "binary" });
  }
  lowering.work.push({ kind: "expression", node: node.right });
  return true;
}

function store(lowering: Lowering, pending: Extract<Work, { readonly kind: "store" }>): boolean {
  const right = popOperand(lowering, failure("an assignment completed without its value", pending.node.origin));
  const reads = lowering.preservedLocals.has(pending.local) ? lowering.exposed : lowering.reads.get(pending.local);
  if (reads !== undefined && !saveReads(lowering, reads)) return false;
  if (!emitStatement(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "assign", place: pending.place,
    value: { kind: "use", operand: right.operand }, step: null })) return false;
  pushOperand(lowering, { ...right, site: siteOf(lowering.body, pending.node) });
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
  // A control point. Operands evaluated earlier and still waiting are saved first where it could write them; its
  // own operands are read by the control point itself, before its effect.
  if (execution.writesStorage && !saveHandedOut(lowering)) return false;
  const result = temporary(lowering, selected.decision.result, site);
  if (result === null) return false;
  // The block the control point continues to starts the evaluation of whatever is pending next.
  // A value is always pushed above the work that consumes it, so that work is pending.
  const pending = requirePresent(lowering.work.at(-1), failure("a value was evaluated with nothing to consume it", node.origin));
  const next = newBlock(state, siteOf(body, pending.node));
  if (next === null) return false;
  // No handler encloses anything this lowering admits: an unwinding failure leaves the body.
  const unwind: MirUnwind = execution.failure === "none" ? { kind: "none" } : execution.failure === "abort" ? { kind: "abort" } : { kind: "escape" };
  terminate(state, { ...site, kind: "invoke", operation: selected, operands: left === null ? [right.operand] : [left.operand, right.operand],
    destination: result, next, unwind, step: null });
  enterBlock(state, next);
  pushOperand(lowering, held(result, selected.decision.result, site));
  return true;
}

function narrow(lowering: Lowering, node: NodeHeader, decision: Extract<NonNullable<TypedValue["narrowing"]>, { readonly kind: "narrowed" }>): boolean {
  const raw = popOperand(lowering, failure("a narrowing was reached without its value", node.origin));
  const { state, body } = lowering;
  const site = siteOf(body, node);
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
  const pending = requirePresent(lowering.work.at(-1), failure("a narrowed value was evaluated with nothing to consume it", node.origin));
  const next = newBlock(state, siteOf(body, pending.node));
  if (next === null) return false;
  terminate(state, { ...site, kind: "check", place: checked, next, unwind: { kind: decision.failure === "abort" ? "abort" : "escape" } });
  enterBlock(state, next);
  pushOperand(lowering, { operand: { kind: "place", place: checked }, inPlace: raw.inPlace, storage: decision.result, site });
  return true;
}

function discard(lowering: Lowering, node: NodeHeader): boolean {
  popOperand(lowering, failure("an expression completed without its value", node.origin));
  return true;
}

function complete(lowering: Lowering, node: ReturnStatement<TypedPhase> | ThrowStatement<TypedPhase> | Expression<TypedPhase>): boolean {
  const result = popOperand(lowering, failure("a completion was reached without its value", node.origin));
  terminate(lowering.state, node.kind === "ThrowStatement" ? { ...siteOf(lowering.body, node), kind: "throw", operand: result.operand, unwind: { kind: "escape" } }
    : { ...siteOf(lowering.body, node), kind: "return", value: result.operand });
  return true;
}
