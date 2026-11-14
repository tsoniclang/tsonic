import type { Diagnostic, InvariantFailure, Result } from "../diag/contract.js";
import { requirePresent, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { BlockId, LocalId, NodeId, Origin, PlaceId, TyId } from "../ids/contract.js";
import type { Block, BreakStatement, ContinueStatement, Expression, ForStatement, LabeledStatement, NodeHeader, ReturnStatement, Statement, ThrowStatement } from "../ir-hir/contract.js";
import type { MirBody, MirLocalRole, MirOperand, MirSite, MirUnwind } from "../ir-mir/contract.js";
import { localOwnershipOfMir } from "../ir-mir/index.js";
import type { TirBody, TypedOperation, TypedPhase, TypedUnary, TypedValue } from "../ir-tir/contract.js";
import type { LiteralValue } from "../ir-types/contract.js";
import type { InternalBodyInput, LowerMirDeps } from "./contract.js";
import type { LowerState } from "./state.js";
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
// temporary, so that the value used is the one read at its authored position. The one handed-out kind this lowering
// admits is the caller's storage (the local of a parameter row not passed by value or moved). When captures, taken
// addresses or hand-over by place are lowered, every local the verifier's law 3 counts as handed out is in this set,
// by the same classification.
//
// Refusal. The size limit is the state's: a primitive that answers null or false has refused. Every step tests that
// answer before it makes the next record and the walk ends at the first refusal with the one diagnostic. No record
// is made after a refusal.
//
// What is lowered, and the frontier. Lowered: a function body (a `Block` root) that is neither asynchronous nor a
// generator and captures nothing; parameter rows of role `required` and `this` in any passing mode; the statements
// blocks, labels and selected breaks, unconditional for loops and their continues, empty and expression statements, returns and throws; selected scalar literals and unary values;
// `Identifier` of a parameter, parentheses, non-null and typed expression wrappers, and `BinaryExpression` of role `arithmetic`, `comparison` or `sequence`; values with selected conversions and narrowings
// that are always demanded. Everything else of the admitted vocabulary is not lowered yet and is refused
// by `notLoweredYet`, the one check of the frontier; each refusal names what it met.

const failure = (message: string, origin: Origin | null): InvariantFailure => ({ owner: "lower-mir", query: null, origin, message });
const invariant = (message: string, origin: Origin | null): never => throwInvariant(failure(message, origin));

/** The frontier: a construct of the admitted vocabulary that this lowering does not lower yet. A compiler defect, not a diagnostic. */
const notLoweredYet = (what: string, origin: Origin): never => invariant(`not lowered yet: ${what}`, origin);

/** A typed body that must not be offered to lowering (section 7 part 7: a caller defect). */
const callerDefect = (what: string, origin: Origin): never => invariant(`caller defect: ${what}`, origin);

type Work =
  | { readonly kind: "statement"; readonly node: Statement<TypedPhase> }
  | { readonly kind: "expression"; readonly node: Expression<TypedPhase> }
  | { readonly kind: "operation"; readonly node: NodeHeader; readonly operation: TypedOperation; readonly form: "unary" | "binary" }
  | { readonly kind: "operation"; readonly node: NodeHeader; readonly operation: TypedOperation; readonly form: "convert"; readonly to: TyId }
  | { readonly kind: "narrow"; readonly node: NodeHeader; readonly narrowing: Extract<NonNullable<TypedValue["narrowing"]>, { readonly kind: "narrowed" }> }
  | { readonly kind: "label-end"; readonly node: LabeledStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "label" }> }
  | { readonly kind: "for"; readonly node: ForStatement<TypedPhase> }
  | { readonly kind: "for-end"; readonly node: ForStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "for-next"; readonly node: ForStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "discard"; readonly node: NodeHeader }
  | { readonly kind: "complete"; readonly node: ReturnStatement<TypedPhase> | ThrowStatement<TypedPhase> };

/** An evaluated operand. `inPlace` is the local whose cell the operand reads with no copy, when it does. */
interface Evaluated {
  readonly operand: MirOperand;
  readonly inPlace: LocalId | null;
  readonly storage: TyId;
  readonly site: MirSite;
}

interface TargetScope {
  exit: BlockId | null;
}

interface LoopContinuation {
  readonly head: BlockId;
  readonly update: { readonly expression: Expression<TypedPhase>; block: BlockId | null } | null;
}

type ControlScope = TargetScope & (
  | { readonly kind: "label"; readonly node: LabeledStatement<TypedPhase>; continuation: LoopContinuation | null }
  | { readonly kind: "loop"; readonly node: ForStatement<TypedPhase>; readonly continuation: LoopContinuation }
);

interface Lowering {
  readonly state: LowerState;
  readonly body: TirBody;
  readonly work: Work[];
  readonly operands: Evaluated[];
  /**
   * The positions in `operands` of the entries read in place from a handed-out local and not saved yet, in stack
   * order. Kept with the stack by `pushOperand` and `popOperand`, so that a writing control point saves exactly these.
   */
  readonly exposed: number[];
  /** The MIR local of each source local that has one. */
  readonly localOf: Map<LocalId, LocalId>;
  readonly labels: Map<NodeId, ControlScope>;
  /** The MIR locals that are handed out: today only the caller's storage. */
  readonly handedOut: Set<LocalId>;
}

const siteOf = (body: TirBody, node: NodeHeader): MirSite => ({ origin: node.origin, tir: { body: body.body, node: node.id } });

/** Pushes an evaluated operand; one read in place from a handed-out local is also exposed. */
function pushOperand(lowering: Lowering, evaluated: Evaluated): void {
  if (evaluated.inPlace !== null && lowering.handedOut.has(evaluated.inPlace)) lowering.exposed.push(lowering.operands.length);
  lowering.operands.push(evaluated);
}

/** Pops the top operand, and its exposure with it. */
function popOperand(lowering: Lowering, missing: InvariantFailure): Evaluated {
  const evaluated = requirePresent(lowering.operands.pop(), missing);
  if (lowering.exposed.at(-1) === lowering.operands.length) lowering.exposed.pop();
  return evaluated;
}

export function lowerBody(deps: LowerMirDeps, body: TirBody, internal: readonly InternalBodyInput[]): Result<MirBody> {
  // The caller sets the limit; a value that is not a count is the caller's defect, as for the MIR verifier's limit.
  const maximumRecords = deps.limits.maximumRecords;
  if (!Number.isSafeInteger(maximumRecords) || maximumRecords < 0 || Object.is(maximumRecords, -0))
    throw new TypeError("lower-mir: maximumRecords must be a safe nonnegative count");
  const root = body.root;
  // Pipeline supplies the data of each initializer execution the body places (§7 part 1). Supplied data says the body
  // places one; no construct this lowering admits does, so such a body is past the frontier.
  if (internal.length !== 0) return notLoweredYet("a body that executes initializer bodies", root.origin);
  if (root.kind !== "Block") return notLoweredYet(`a body whose root is ${root.kind}`, root.origin);
  if (body.asynchronous || body.generator) return notLoweredYet("an asynchronous body or a generator", root.origin);
  if (body.captures.length !== 0) return notLoweredYet("a body that captures", root.origin);
  const lowering: Lowering = { state: createState(body.body, body.bindings, body.completion, deps.limits), body, work: [], operands: [],
    exposed: [], localOf: new Map(), labels: new Map(), handedOut: new Set() };
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
function enter(lowering: Lowering, root: Block<TypedPhase>): boolean {
  const { state, body } = lowering;
  let parameters = 0;
  for (const row of body.params) {
    if (row.role !== "required" && row.role !== "this") return notLoweredYet(`a parameter of role ${row.role}`, root.origin);
    const role: MirLocalRole = row.role === "this" ? { kind: "receiver" } : { kind: "parameter", index: parameters };
    const local = newLocal(state, row.storage, role, row.passing,
      { body: body.body, local: row.local }, root.origin);
    if (local === null) return false;
    if (row.role !== "this") parameters += 1;
    lowering.localOf.set(row.local, local);
    // The local of a row not passed by value or moved is the caller's storage: handed out from entry.
    if (localOwnershipOfMir(row.passing) === "external") lowering.handedOut.add(local);
  }
  const first = newBlock(state, siteOf(body, root));
  if (first === null) return false;
  enterBlock(state, first);
  // Every fixed parameter is required: the full count is the one admissible supplied count.
  addEntry(state, { provided: parameters, block: first });
  lowering.work.push({ kind: "statement", node: root });
  return true;
}

/** Runs the pending work to its end. False: refused. */
function walk(lowering: Lowering): boolean {
  for (let next = lowering.work.pop(); next !== undefined; next = lowering.work.pop()) {
    const done = next.kind === "statement" ? statement(lowering, next.node)
      : next.kind === "expression" ? expression(lowering, next.node)
        : next.kind === "operation" ? operation(lowering, next)
          : next.kind === "narrow" ? narrow(lowering, next.node, next.narrowing)
            : next.kind === "label-end" ? endLabel(lowering, next.node, next.scope)
              : next.kind === "for" ? enterFor(lowering, next.node)
                : next.kind === "for-end" ? endFor(lowering, next)
                  : next.kind === "for-next" ? nextFor(lowering, next)
                    : next.kind === "discard" ? discard(lowering, next.node) : complete(lowering, next.node);
    if (!done) return false;
  }
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
  return finishBody(state);
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
      const scope: Extract<ControlScope, { readonly kind: "label" }> = { kind: "label", node, exit: null, continuation: null };
      lowering.labels.set(target.node, scope);
      lowering.work.push({ kind: "label-end", node, scope }, { kind: "statement", node: node.statement });
      return true;
    }
    case "BreakStatement": return breaks(lowering, node);
    case "ContinueStatement": return continues(lowering, node);
    case "ForStatement":
      if (node.condition !== null) return notLoweredYet("a for loop with a condition", node.origin);
      if (node.initializer !== null && node.initializer.kind === "VariableDeclarationList") return notLoweredYet("for initialization by declarations", node.origin);
      if (node.initializer !== null && node.initializer.kind === "MissingDeclaration") return callerDefect("a missing declaration in for initialization", node.origin);
      lowering.work.push({ kind: "for", node });
      if (node.initializer !== null) lowering.work.push({ kind: "discard", node }, { kind: "expression", node: node.initializer });
      return true;
    case "EmptyStatement": return true;
    case "ExpressionStatement":
      lowering.work.push({ kind: "discard", node }, { kind: "expression", node: node.expression });
      return true;
    case "Block":
      // A statement list has no hole; one is a defect of the tree, reported by name as the other unreachable states are.
      for (let index = node.statements.nodes.length - 1; index >= 0; index -= 1)
        lowering.work.push({ kind: "statement", node: requirePresent(node.statements.nodes[index], failure("a statement list has a hole", node.origin)) });
      return true;
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
  if (payload.demand.kind !== "always") return notLoweredYet("a value demanded under a selection", node.origin);
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
      if (payload.role === "sequence") {
        value(lowering, payload, node);
        lowering.work.push({ kind: "expression", node: node.right }, { kind: "discard", node: node.left }, { kind: "expression", node: node.left });
        return true;
      }
      if (payload.role !== "arithmetic" && payload.role !== "comparison") return notLoweredYet(`a binary expression of role ${payload.role}`, node.origin);
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

/** The place of a new temporary whose slot begins here. Null: refused. */
function temporary(lowering: Lowering, storage: TyId, site: MirSite): PlaceId | null {
  const local = newLocal(lowering.state, storage, { kind: "temporary" }, "local", null, site.origin);
  if (local === null) return null;
  const place = placeOfLocal(lowering.state, local);
  return place !== null && emitStatement(lowering.state, { ...site, kind: "storage-live", local }) ? place : null;
}

/** A temporary as an operand. It is written by one record and by nothing else, so it is read in place and never saved. */
const held = (place: PlaceId, storage: TyId, site: MirSite): Evaluated => ({ operand: { kind: "place", place }, inPlace: null, storage, site });

/**
 * Saves each waiting operand read in place from a handed-out local, once: a saved operand is a temporary and is not
 * exposed again. Each evaluated read is saved by itself, also when two read the same local. False: refused.
 */
function saveHandedOut(lowering: Lowering): boolean {
  for (const position of lowering.exposed) {
    const pending = requirePresent(lowering.operands[position], failure("an exposed operand is not on the stack", null));
    const saved = temporary(lowering, pending.storage, pending.site);
    if (saved === null) return false;
    if (!emitStatement(lowering.state, { ...pending.site, kind: "assign", place: saved, value: { kind: "use", operand: pending.operand }, step: null }))
      return false;
    lowering.operands[position] = held(saved, pending.storage, pending.site);
  }
  lowering.exposed.length = 0;
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

function breaks(lowering: Lowering, node: BreakStatement<TypedPhase>): boolean {
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

function endLabel(lowering: Lowering, node: LabeledStatement<TypedPhase>, scope: Extract<ControlScope, { readonly kind: "label" }>): boolean {
  if (scope.exit !== null) {
    enterBlock(lowering.state, scope.exit);
  }
  lowering.labels.delete(node.tsonic.target.node);
  return true;
}

function continues(lowering: Lowering, node: ContinueStatement<TypedPhase>): boolean {
  const target = node.tsonic.target;
  if (target.body !== lowering.body.body) return callerDefect("a continue targets another body", node.origin);
  const scope = lowering.labels.get(target.node);
  if (scope === undefined || scope.continuation === null) return callerDefect("a continue has no active loop target", node.origin);
  const next = continuationTarget(lowering, scope.continuation);
  if (next === null) return false;
  terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "goto", target: next });
  return true;
}

function enterFor(lowering: Lowering, node: ForStatement<TypedPhase>): boolean {
  const { state, body } = lowering;
  const head = newBlock(state, siteOf(body, node.statement));
  if (head === null) return false;
  terminate(state, { ...siteOf(body, node), kind: "goto", target: head });
  enterBlock(state, head);
  const continuation: LoopContinuation = { head, update: node.incrementor === null ? null : { expression: node.incrementor, block: null } };
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
  lowering.work.push({ kind: "for-end", node, scope, previous }, { kind: "statement", node: node.statement });
  return true;
}

function endFor(lowering: Lowering, pending: Extract<Work, { readonly kind: "for-end" }>): boolean {
  const { node, scope } = pending;
  if (lowering.state.current !== null) {
    const target = continuationTarget(lowering, scope.continuation);
    if (target === null) return false;
    terminate(lowering.state, { ...siteOf(lowering.body, node), kind: "goto", target });
  }
  const update = scope.continuation.update;
  if (update === null || update.block === null) return closeFor(lowering, pending);
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

function nextFor(lowering: Lowering, pending: Extract<Work, { readonly kind: "for-next" }>): boolean {
  terminate(lowering.state, { ...siteOf(lowering.body, pending.node), kind: "goto", target: pending.scope.continuation.head });
  return closeFor(lowering, pending);
}

function closeFor(lowering: Lowering, pending: Extract<Work, { readonly kind: "for-end" | "for-next" }>): boolean {
  const { node, scope, previous } = pending;
  if (previous === undefined) lowering.labels.delete(node.id);
  else lowering.labels.set(node.id, previous);
  if (scope.exit !== null) enterBlock(lowering.state, scope.exit);
  return true;
}

function rawType(payload: TypedValue): TyId {
  return payload.narrowing !== null && payload.narrowing.kind === "narrowed" ? payload.narrowing.source : payload.type;
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

function complete(lowering: Lowering, node: ReturnStatement<TypedPhase> | ThrowStatement<TypedPhase>): boolean {
  const result = popOperand(lowering, failure("a completion was reached without its value", node.origin));
  terminate(lowering.state, node.kind === "ReturnStatement" ? { ...siteOf(lowering.body, node), kind: "return", value: result.operand }
    : { ...siteOf(lowering.body, node), kind: "throw", operand: result.operand, unwind: { kind: "escape" } });
  return true;
}
