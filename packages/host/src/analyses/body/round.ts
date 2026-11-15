import type { DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, refuseAccount } from "../../dataflow/index.js";
import type { Diagnostic, DiagnosticIdentity, ErrorValue, UnitResult } from "../../diag/contract.js";
import { hostDiagnosticCode, requirePresent, resourceLimitDiagnostic } from "../../diag/index.js";
import type { NodeId, OriginsId, PlaceId, TyId } from "../../ids/contract.js";
import { originsId, producerId, valueContextId } from "../../ids/index.js";
import type { BoundActivation, InitializationFact, IntegerFact, Producer, ReadOriginsFact, SubjectOriginsFact, Summary, ValueContext, WriteFact } from "../../ir-facts/contract.js";
import { admitSummaryIdentity } from "../../ir-facts/index.js";
import type { MirOperand, MirSite } from "../../ir-mir/contract.js";
import { localOwnershipOfMir } from "../../ir-mir/index.js";
import type { TirNode } from "../../ir-tir/contract.js";
import { nativeCarrierOf, sameInstance } from "../../ir-types/index.js";
import type { BodyRoundDeps, BodyRoundInput, BodyRoundResult, BodyRoundValue } from "./contract.js";
import type { CallError } from "./calls.js";
import { applyScalarCall, callSummary, initializerCallee, isCallError } from "./calls.js";
import { orderedRows, sourceOccurrences } from "./source.js";
import { assignedEntry, bodyFrontier, readLocal, solveAssigned, statementOperands, terminatorOperands, transferAssigned } from "./storage.js";

function scalarKind(deps: BodyRoundDeps, type: TyId): "primitive" | "absence" | null {
  const selected = nativeCarrierOf(deps.types, type, current =>
    chargeWork(deps.account, 1) === null ? deps.typeOf(current) : null);
  if (selected.kind === "resource-stop") return null;
  if (selected.kind === "primitive") return "primitive";
  if (chargeWork(deps.account, 1) !== null) return null;
  const term = deps.typeOf(selected.type);
  return term.kind === "intrinsic" && term.intrinsic === "absence" ? "absence" : null;
}

function uninitialized(deps: BodyRoundDeps, site: MirSite): UnitResult<ErrorValue> {
  const code = hostDiagnosticCode("TSONIC_READ_BEFORE_INITIALIZATION");
  const identity: DiagnosticIdentity = { kind: "host", unit: { request: deps.unit, position: { kind: "result" } }, code };
  const diagnostic: Diagnostic = { code: { kind: "host", name: code, rendered: code }, severity: "error",
    site: { kind: "source", origin: site.origin }, source: "analyses/initialization", evidence: [],
    message: "The execution reads its own storage before initialization.", arguments: [], related: [], fix: null };
  const error: ErrorValue = { kind: "error", causes: [{ kind: "diagnostic", diagnostic: identity }] };
  return { kind: "ok", value: error, positions: [{ position: { kind: "result" }, error }], diagnostics: [diagnostic],
    emissions: [{ identity, diagnostic }] };
}

function operandSite(node: TirNode | undefined, position: number, fallback: NodeId): NodeId {
  if (node?.kind === "BinaryExpression") {
    if (node.tsonic.role === "assignment" && node.tsonic.calculation === null) return node.right.id;
    return position === 0 ? node.left.id : node.right.id;
  }
  if (node?.kind === "PrefixUnaryExpression" || node?.kind === "PostfixUnaryExpression") return node.operand.id;
  if (node?.kind === "ReturnStatement" && node.expression !== null) return node.expression.id;
  return fallback;
}

function failedCall(deps: BodyRoundDeps, failure: CallError): BodyRoundResult {
  const admission = chargeWork(deps.account, 2) ?? chargeResultEntries(deps.account, 8);
  if (admission !== null) return admission;
  const error: ErrorValue = { kind: "error", causes: [{ kind: "unit", unit: failure.unit }] };
  return { kind: "complete", value: { kind: "ok", value: error, diagnostics: [], emissions: [],
    positions: [{ position: { kind: "result" }, error }] } };
}

export function analyzeRound(deps: BodyRoundDeps, input: BodyRoundInput): BodyRoundResult {
  const { account } = deps;
  const prior = accountFailure(account);
  if (prior !== null) return prior;
  const { execution, mir, tir, liveness } = input;
  const identity = admitSummaryIdentity({ kind: "body", execution }, account)
    ?? admitSummaryIdentity({ kind: "body", execution: { instance: { body: mir.body, bindings: mir.bindings }, provided: execution.provided } }, account)
    ?? admitSummaryIdentity({ kind: "body", execution }, account)
    ?? admitSummaryIdentity({ kind: "body", execution: { instance: { body: tir.body, bindings: tir.bindings }, provided: execution.provided } }, account);
  if (identity !== null) return identity;
  if (!sameInstance(execution.instance, { body: mir.body, bindings: mir.bindings })
    || !sameInstance(execution.instance, { body: tir.body, bindings: tir.bindings }) || mir.bindings.kind !== "instantiated")
    return bodyFrontier("A body round requires the same complete selected execution, MIR and TIR.");
  const setup = chargeWork(account, mir.locals.length + mir.places.length + mir.constants.length + tir.captures.length)
    ?? chargeResultEntries(account, 8 + mir.locals.length + mir.constants.length);
  if (setup !== null) return setup;
  if (tir.captures.length !== 0) return bodyFrontier("BodyAnalysis requires the actual Origins capture-to-cell association for captured execution.");
  const empty = originsId(0);
  const absent = originsId(1);
  const localOrigins: OriginsId[] = [];
  const constantOrigins: OriginsId[] = [];
  const parameterOrigins: OriginsId[] = [];
  let receiverOrigins: OriginsId | null = null;
  let hasAbsence = false;
  for (const local of mir.locals) {
    if (localOwnershipOfMir(local.mode) !== "body")
      return bodyFrontier("BodyAnalysis requires the actual caller-cell binding of this external storage mode.");
    const kind = scalarKind(deps, local.storage);
    if (kind === null) {
      const stop = accountFailure(account);
      return stop ?? bodyFrontier("BodyAnalysis requires the actual Origins reference/cell producer for this selected local.");
    }
    const origins = kind === "absence" ? absent : empty;
    hasAbsence ||= kind === "absence";
    localOrigins.push(origins);
    if (local.role.kind === "parameter") {
      const slot = chargeResultEntries(account, 1);
      if (slot !== null) return slot;
      parameterOrigins[local.role.index] = origins;
    } else if (local.role.kind === "receiver") receiverOrigins = origins;
  }
  for (const place of mir.places) if (place.base.kind !== "local")
    return bodyFrontier("BodyAnalysis requires the actual selected projection or static-cell producer for this place.");
  for (const constant of mir.constants) {
    const kind = scalarKind(deps, constant.type);
    if (constant.value.kind !== "literal" || kind === null || (constant.value.value.kind === "absence") !== (kind === "absence")) {
      const stop = accountFailure(account);
      return stop ?? bodyFrontier("BodyAnalysis requires the actual selected non-scalar constant relation.");
    }
    hasAbsence ||= kind === "absence";
    constantOrigins.push(kind === "absence" ? absent : empty);
  }
  const signatureWork = chargeWork(account, 1);
  if (signatureWork !== null) return signatureWork;
  const signature = deps.signatureOf(tir.signature);
  const summaryWork = chargeResultEntries(account, 40 + signature.parameters.length * 4);
  if (summaryWork !== null) return summaryWork;
  const bounded = (limit: "maximumRelationalRecordsPerBody" | "maximumRelationalReferencesPerBody" | "maximumConditionAlternatives", size: number): DataflowStop | null =>
    size <= deps.limits[limit] ? null : refuseAccount(account, { kind: "refused", diagnostics: [
      resourceLimitDiagnostic({ owner: "analyses/origins", limit: `analysis.${limit}`, maximum: deps.limits[limit],
        site: { kind: "source", origin: tir.root.origin }, unit: { request: deps.unit, position: { kind: "result" } } })] });
  const formalCount = signature.parameters.length + (signature.receiver === null ? 0 : 1);
  const bound = bounded("maximumRelationalRecordsPerBody", 2 + formalCount + (hasAbsence ? 1 : 0))
    ?? bounded("maximumRelationalReferencesPerBody", signature.parameters.length + (signature.receiver === null ? 0 : 1))
    ?? bounded("maximumConditionAlternatives", 1);
  if (bound !== null) return bound;
  const producers: Producer[] = [];
  if (signature.receiver !== null) {
    const receiverWork = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (receiverWork !== null) return receiverWork;
    producers.push({ id: producerId(0), path: null, kind: "receiver" });
  }
  for (let index = 0; index < signature.parameters.length; index += 1) {
    const formalWork = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (formalWork !== null) return formalWork;
    producers.push({ id: producerId(producers.length), path: null, kind: "parameter", index });
  }
  const argumentWork = chargeWork(account, signature.parameters.length) ?? chargeResultEntries(account, hasAbsence ? 1 : 0);
  if (argumentWork !== null) return argumentWork;
  const contexts: ValueContext[] = [{ id: valueContextId(0), receiver: signature.receiver === null ? null
    : requirePresent(receiverOrigins, { owner: "analyses/body", query: null, origin: null, message: "A selected receiver retains its actual scalar origins." }),
    arguments: signature.parameters.map((_, index) => requirePresent(parameterOrigins[index],
      { owner: "analyses/body", query: null, origin: null, message: "Every actual selected formal retains its scalar origins." })), captures: [] }];
  const arena = { cells: [], projections: [], producers, boundProducers: [], boundaries: [], contexts,
    origins: hasAbsence ? [{ id: empty, kind: "complete", producers: [], includesAbsence: false },
      { id: absent, kind: "complete", producers: [], includesAbsence: true }]
      : [{ id: empty, kind: "complete", producers: [], includesAbsence: false }] } satisfies BodyRoundValue["facts"]["arena"];
  const source = sourceOccurrences(tir, account);
  if (source.kind !== "complete") return source;
  const solved = solveAssigned(deps, input);
  if (solved.kind !== "complete") return solved;
  if (solved.value.error !== null) return failedCall(deps, solved.value.error);
  const initialized = new Map<NodeId, Map<PlaceId, InitializationFact>>();
  let initializedCount = 0;
  const reads: ReadOriginsFact[] = [];
  const subjects: SubjectOriginsFact[] = [];
  const writes: WriteFact[] = [];
  const activations: BoundActivation[] = [];
  let returns = false;
  let resultOrigins = empty;
  const originsOf = (operand: MirOperand): OriginsId => requirePresent(operand.kind === "constant" ? constantOrigins[operand.constant]
    : localOrigins[readLocal(mir, operand)], { owner: "analyses/body", query: null, origin: null,
      message: "A verified scalar operand retains its actual absence disposition." });
  const read = (operand: MirOperand, node: NodeId, assigned: ReadonlySet<number>): boolean => {
    if (chargeWork(account, 1) !== null || chargeResultEntries(account, 2) !== null) return false;
    if (operand.kind === "constant") return true;
    const local = readLocal(mir, operand);
    let occurrences = initialized.get(node);
    if (occurrences === undefined) {
      if (chargeResultEntries(account, 1) !== null) return false;
      occurrences = new Map<PlaceId, InitializationFact>();
      initialized.set(node, occurrences);
    }
    const previous = occurrences.get(operand.place);
    const present = assigned.has(local);
    if (previous === undefined) {
      initializedCount += 1;
      occurrences.set(operand.place, { node, place: operand.place, assigned: present });
      reads.push({ node, place: operand.place, origins: originsOf(operand) });
    }
    return present;
  };
  for (const block of mir.blocks) {
    const blockWork = chargeWork(account, 1);
    if (blockWork !== null) return blockWork;
    if (solved.value.reachable[block.id] !== true) continue;
    if (solved.value.entry[block.id] === null) continue;
    let assigned = assignedEntry(solved.value.entry, block.id);
    let position = 0;
    for (const row of block.statements) {
      const statementWork = chargeWork(account, 4) ?? chargeResultEntries(account, 3);
      if (statementWork !== null) return statementWork;
      const statement = requirePresent(row, { owner: "analyses/body", query: null, origin: null,
        message: "A verified block retains its actual statement." });
      const operands = statementOperands(statement);
      let index = 0;
      for (const operand of operands) {
        if (!read(operand, operandSite(source.value.get(statement.tir.node), index, statement.tir.node), assigned)) {
          const stop = accountFailure(account);
          if (stop !== null) return stop;
          const failure = chargeWork(account, 5) ?? chargeResultEntries(account, 8);
          return failure ?? { kind: "complete", value: uninitialized(deps, statement) };
        }
        index += 1;
      }
      if (statement.kind === "assign") {
        const value = statement.value;
        if (value.kind !== "use" && (value.kind !== "unary" && value.kind !== "binary" && value.kind !== "convert"
          || value.operation.decision.kind !== "selected" || value.operation.decision.execution.kind !== "pure"))
          return bodyFrontier("BodyAnalysis requires the actual selected operation effect and Origins transport.");
        const local = readLocal(mir, { kind: "place", place: statement.place });
        const storeWork = chargeResultEntries(account, 3);
        if (storeWork !== null) return storeWork;
        writes.push({ point: { block: block.id, statement: position }, node: statement.tir.node,
          operation: assigned.has(local) ? "mutation" : "initialization", destination: "binding", targets: [], owner: null,
          values: [{ source: statement.tir, origins: originsOf({ kind: "place", place: statement.place }), reason: null }], boundaries: [] });
      }
      const next = transferAssigned(mir, statement, assigned, account);
      const transferStop = accountFailure(account);
      if (transferStop !== null) return transferStop;
      assigned = next;
      position += 1;
    }
    const terminatorWork = chargeWork(account, 3) ?? chargeResultEntries(account, 2);
    if (terminatorWork !== null) return terminatorWork;
    const terminator = block.terminator;
    if (terminator.kind === "call") {
      const selected = callSummary(deps, mir, terminator);
      if (selected.kind !== "complete") return selected;
      if (isCallError(selected.value)) return failedCall(deps, selected.value);
      const bound = bounded("maximumRelationalRecordsPerBody", arena.producers.length + arena.contexts.length + arena.origins.length + 1);
      if (bound !== null) return bound;
      const growth = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
      if (growth !== null) return growth;
      const context = valueContextId(contexts.length);
      contexts.push({ id: context, receiver: null, arguments: [], captures: [] });
      const point = { block: block.id, statement: null };
      const applied = applyScalarCall(deps, input, terminator, point, selected.value, arena, context);
      if (applied.kind !== "complete") return applied;
      activations.push({ node: terminator.tir.node, point, activation: initializerCallee(terminator).instance, context,
        caller: valueContextId(0), entry: null });
      if (selected.value.returns && terminator.destination !== null) {
        const local = readLocal(mir, { kind: "place", place: terminator.destination });
        const write = chargeResultEntries(account, 3);
        if (write !== null) return write;
        writes.push({ point, node: terminator.tir.node, operation: assigned.has(local) ? "mutation" : "initialization",
          destination: "binding", targets: [], owner: null,
          values: [{ source: terminator.tir, origins: originsOf({ kind: "place", place: terminator.destination }), reason: null }], boundaries: [] });
      }
      continue;
    }
    for (const operand of terminatorOperands(terminator)) {
      if (!read(operand, operandSite(source.value.get(terminator.tir.node), 0, terminator.tir.node), assigned)) {
        const stop = accountFailure(account);
        if (stop !== null) return stop;
        const failure = chargeWork(account, 5) ?? chargeResultEntries(account, 8);
        return failure ?? { kind: "complete", value: uninitialized(deps, terminator) };
      }
    }
    if (terminator.kind === "return") {
      returns = true;
      if (terminator.value !== null) {
        const origins = originsOf(terminator.value);
        if (origins === absent) resultOrigins = absent;
        subjects.push({ node: terminator.tir.node, role: "return", path: null, origins });
      }
    }
  }
  const collection = chargeWork(account, initialized.size + initializedCount) ?? chargeResultEntries(account, initializedCount);
  if (collection !== null) return collection;
  const initializationRows: InitializationFact[] = [];
  for (const occurrences of initialized.values()) for (const row of occurrences.values()) initializationRows.push(row);
  const initialization = orderedRows(initializationRows, (left, right) => left.node - right.node || left.place - right.place, account);
  if (initialization.kind !== "complete") return initialization;
  const readRows = orderedRows(reads, (left, right) => left.node - right.node || left.place - right.place, account);
  if (readRows.kind !== "complete") return readRows;
  const subjectRows = orderedRows(subjects, (left, right) => left.node - right.node, account);
  if (subjectRows.kind !== "complete") return subjectRows;
  const integers: IntegerFact[] = [];
  for (const node of source.value.values()) {
    const nodeWork = chargeWork(account, 1);
    if (nodeWork !== null) return nodeWork;
    if (node.tsonic !== null && "convertedType" in node.tsonic) {
      if (node.tsonic.narrowing !== null)
        return bodyFrontier("BodyAnalysis requires the actual selected guard proof/invalidation relation for this refinement.");
      const integerWork = chargeResultEntries(account, 1);
      if (integerWork !== null) return integerWork;
      integers.push({ node: node.id, range: null, nonnegative: false });
    }
  }
  const integerRows = orderedRows(integers, (left, right) => left.node - right.node, account);
  if (integerRows.kind !== "complete") return integerRows;
  const summary: Summary = { key: { kind: "body", execution }, signature: tir.signature, arena,
    parameters: [], captures: [], result: resultOrigins, thrown: empty, writes: [], retention: [], callbacks: [],
    concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [], returns, unwinds: false,
    initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }],
      points: returns ? [{ kind: "return" }] : [], rows: returns ? [{ point: 0, cell: null, condition: 0 }] : [] },
    resultCells: [], backing: [], suspends: false, bindingDependent: tir.dependence === "binding-dependent" };
  const effects: Summary["parameters"][number][] = [];
  if (signature.receiver !== null) effects.push({ slot: { kind: "receiver" }, reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } });
  for (let index = 0; index < signature.parameters.length; index += 1) effects.push({ slot: { kind: "parameter", index },
    reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } });
  const value: BodyRoundValue = { facts: { execution, arena, liveness, initialization: { reads: initialization.value },
    refinements: { refinements: [], integers: integerRows.value, countedLoops: [] }, origins: { points: [], reads: readRows.value,
      subjects: subjectRows.value, writes, escapes: [], invocations: [], callbacks: [], activations, frontiers: [],
      constructions: [], instanceRegions: [], exitContents: { onReturn: [], onUnwind: [] } },
    suspension: { suspensions: [] }, errorStorage: { errors: [] }, pointerBacking: { pointers: [] }, rawLocations: [],
    fieldBindings: [], recordBindings: [], memoryBindings: [], selectedMemoryDeclarations: [], closedArrays: [] },
    summary: { ...summary, parameters: effects } };
  return { kind: "complete", value: { kind: "ok", value, diagnostics: [], emissions: [], positions: [{ position: { kind: "result" }, error: null }] } };
}
