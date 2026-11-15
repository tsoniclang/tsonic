import type { DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, refuseAccount } from "../../dataflow/index.js";
import type { Diagnostic, DiagnosticIdentity, ErrorValue, UnitResult } from "../../diag/contract.js";
import { hostDiagnosticCode, requirePresent, resourceLimitDiagnostic } from "../../diag/index.js";
import type { LocalId, NodeId, OriginsId, PlaceId, ProducerId } from "../../ids/contract.js";
import { boundProducerId, originsId, producerId, valueContextId } from "../../ids/index.js";
import type { ArgumentTransport, BoundActivation, BoundProducer, CaptureLocation, EscapeFact, InitializationFact, InitializationPoint, InitializationRow, IntegerFact, InvocationFact, LogicalCellRow, MirPoint, Origins, Producer, ReadOriginsFact, SubjectOriginsFact, Summary, SummaryApplicationInput, SummaryRetention, ValueContext, ValueEntryBinding, WriteFact } from "../../ir-facts/contract.js";
import { admitSummaryIdentity, summaryPositionKey } from "../../ir-facts/index.js";
import type { MirLocal, MirOperand, MirSite } from "../../ir-mir/contract.js";
import { localOwnershipOfMir } from "../../ir-mir/index.js";
import type { TirNode } from "../../ir-tir/contract.js";
import { sameInstance } from "../../ir-types/index.js";
import type { BodyRoundDeps, BodyRoundInput, BodyRoundResult, BodyRoundValue } from "./contract.js";
import type { CallError } from "./calls.js";
import { applyScalarCall, callInstance, callSummary, isCallError, scalarArgument } from "./calls.js";
import { orderedRows, sourceOccurrences } from "./source.js";
import { assignedEntry, solveAssigned, statementOperands, terminatorOperands, transferAssigned } from "./storage.js";
import { prepareCallCaptures } from "./captures.js";
import { bodyFrontier, readLocal } from "./places.js";
import { appliedOrigins, joinOrigins, valueKind, valueOrigins } from "./values.js";
import { operandOrigins, solveValueOrigins, transferValue } from "./value-flow.js";
import { captureMustAtExit, recordInitializationPoint, sourceNeedAssigned } from "./initialization.js";
import { collectCellWrites, recordCaptureWrite } from "./writes.js";

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
    ?? chargeResultEntries(account, 15 + mir.locals.length + mir.constants.length);
  if (setup !== null) return setup;
  const capturedLocals = new Map<number, number>();
  const capturedEntries: LocalId[] = [];
  const cells: LogicalCellRow[] = [];
  const boundProducers: BoundProducer[] = [];
  const captureLocations: CaptureLocation[] = [];
  const cellLocals: LocalId[] = [];
  const empty = originsId(0);
  const absent = originsId(1);
  const localOrigins: OriginsId[] = [];
  const constantOrigins: OriginsId[] = [];
  const parameterOrigins: OriginsId[] = [];
  const referenceEntries: { readonly local: LocalId; readonly role: Extract<MirLocal["role"], { readonly kind: "parameter" | "receiver" }> }[] = [];
  let receiverOrigins: OriginsId | null = null;
  let hasAbsence = false;
  let hasReference = false;
  let referenceCaptureCount = 0;
  for (const local of mir.locals) {
    if (local.role.kind === "capture") {
      const captureWork = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
      if (captureWork !== null) return captureWork;
      const capture = tir.captures[local.role.index];
      if (capture?.capture !== "captured-location" || local.mode !== "captured-location"
        || local.source === null || local.source.body !== capture.local.body || local.source.local !== capture.local.local)
        return bodyFrontier("BodyAnalysis requires the actual Origins capture-to-cell association, including a distinct copied capture slot when selected.");
      capturedLocals.set(local.id, local.role.index);
      capturedEntries[local.role.index] = local.id;
    } else if (localOwnershipOfMir(local.mode) !== "body")
      return bodyFrontier("BodyAnalysis requires the actual caller-cell binding of this external storage mode.");
    const kind = valueKind(deps, local.storage);
    if (kind === null) {
      const stop = accountFailure(account);
      return stop ?? bodyFrontier("BodyAnalysis requires the actual Origins reference/cell producer for this selected local.");
    }
    if (kind === "reference") {
      hasReference = true;
      if (local.role.kind === "capture") referenceCaptureCount += 1;
      const entry = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
      if (entry !== null) return entry;
      if (local.role.kind === "parameter" || local.role.kind === "receiver") referenceEntries.push({ local: local.id, role: local.role });
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
  if (capturedLocals.size !== tir.captures.length)
    return bodyFrontier("BodyAnalysis requires the actual Origins capture-to-cell association for every selected captured execution slot.");
  for (const constant of mir.constants) {
    const kind = valueKind(deps, constant.type);
    if (constant.value.kind !== "literal" || kind === null || kind === "reference" || (constant.value.value.kind === "absence") !== (kind === "absence")) {
      const stop = accountFailure(account);
      return stop ?? bodyFrontier("BodyAnalysis requires the actual selected non-scalar constant relation.");
    }
    hasAbsence ||= kind === "absence";
    constantOrigins.push(kind === "absence" ? absent : empty);
  }
  const signatureWork = chargeWork(account, 1);
  if (signatureWork !== null) return signatureWork;
  const signature = deps.signatureOf(tir.signature);
  const signatureStop = accountFailure(account);
  if (signatureStop !== null) return signatureStop;
  const summaryWork = chargeResultEntries(account, 40 + signature.parameters.length * 4);
  if (summaryWork !== null) return summaryWork;
  const bounded = (limit: "maximumRelationalRecordsPerBody" | "maximumRelationalReferencesPerBody" | "maximumConditionAlternatives" | "maximumOriginAlternatives",
    size: number, retained = 0): DataflowStop | null =>
    size <= deps.limits[limit] - retained ? null : refuseAccount(account, { kind: "refused", diagnostics: [
      resourceLimitDiagnostic({ owner: "analyses/origins", limit: `analysis.${limit}`, maximum: deps.limits[limit],
        site: { kind: "source", origin: tir.root.origin }, unit: { request: deps.unit, position: { kind: "result" } } })] });
  const formalCount = signature.parameters.length + (signature.receiver === null ? 0 : 1);
  let contextReferences = formalCount + tir.captures.length * 5 + referenceEntries.length * 3 + referenceCaptureCount;
  let lifetimeRecords = 0;
  const bound = bounded("maximumRelationalRecordsPerBody", 2 + formalCount + tir.captures.length * 3 + (hasAbsence ? 1 : 0) + referenceEntries.length * 2 + referenceCaptureCount)
    ?? bounded("maximumRelationalReferencesPerBody", contextReferences)
    ?? bounded("maximumConditionAlternatives", 1)
    ?? (referenceEntries.length + referenceCaptureCount === 0 ? null : bounded("maximumOriginAlternatives", 1));
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
  const originRows: Origins[] = [{ id: empty, kind: "complete", producers: [], includesAbsence: false }];
  if (hasAbsence) originRows.push({ id: absent, kind: "complete", producers: [], includesAbsence: true });
  const initialWork = chargeWork(account, localOrigins.length) ?? chargeResultEntries(account, localOrigins.length);
  if (initialWork !== null) return initialWork;
  const initialOrigins = [...localOrigins];
  for (const local of referenceEntries) {
    const entry = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
    if (entry !== null) return entry;
    const producer = local.role.kind === "receiver" ? 0 : local.role.index + (signature.receiver === null ? 0 : 1);
    if (producers[producer]?.kind !== local.role.kind)
      return bodyFrontier("A reference entry retains its actual signature formal or receiver producer.");
    const bound = boundProducerId(boundProducers.length);
    const origins = originsId(originRows.length);
    boundProducers.push({ id: bound, producer: producerId(producer), bindings: mir.bindings.bindings, context: valueContextId(0) });
    originRows.push({ id: origins, kind: "complete", producers: [bound], includesAbsence: false });
    localOrigins[local.local] = origins;
    if (local.role.kind === "parameter") parameterOrigins[local.role.index] = origins;
    else receiverOrigins = origins;
  }
  for (let index = 0; index < capturedEntries.length; index += 1) {
    const captureWork = chargeWork(account, 1) ?? chargeResultEntries(account, 10);
    if (captureWork !== null) return captureWork;
    const local = requirePresent(capturedEntries[index], { owner: "analyses/body", query: null, origin: null,
      message: "A verified selected capture inventory retains every actual incoming MIR local." });
    const producer = producerId(producers.length);
    const location = boundProducerId(boundProducers.length);
    cells.push({ id: index, role: { kind: "capture", index }, occurrence: { kind: "entry", execution, local }, lifetimes: [] });
    cellLocals.push(local);
    producers.push({ id: producer, path: null, kind: "capture", index });
    boundProducers.push({ id: location, producer, bindings: tir.lexicalBindings, context: valueContextId(0) });
    captureLocations.push({ index, location, cell: index });
    const kind = valueKind(deps, requirePresent(mir.locals[local], { owner: "analyses/body", query: null, origin: null,
      message: "An actual capture retains its selected local storage." }).storage);
    const classified = accountFailure(account);
    if (classified !== null) return classified;
    if (kind === "reference") {
      const growth = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
      if (growth !== null) return growth;
      const origins = originsId(originRows.length);
      originRows.push({ id: origins, kind: "complete", producers: [location], includesAbsence: false });
      localOrigins[local] = origins;
    }
  }
  const entryBoundCount = boundProducers.length;
  const argumentWork = chargeWork(account, signature.parameters.length) ?? chargeResultEntries(account, hasAbsence ? 1 : 0);
  if (argumentWork !== null) return argumentWork;
  const contexts: ValueContext[] = [{ id: valueContextId(0), receiver: signature.receiver === null ? null
    : requirePresent(receiverOrigins, { owner: "analyses/body", query: null, origin: null, message: "A selected receiver retains its actual scalar origins." }),
    arguments: signature.parameters.map((_, index) => requirePresent(parameterOrigins[index],
      { owner: "analyses/body", query: null, origin: null, message: "Every actual selected formal retains its scalar origins." })), captures: captureLocations }];
  const arena = { cells, projections: [], producers, boundProducers, boundaries: [], contexts,
    origins: originRows } satisfies BodyRoundValue["facts"]["arena"];
  const values = valueOrigins(deps, originRows);
  if (values.kind !== "complete") return values;
  const source = sourceOccurrences(tir, account);
  if (source.kind !== "complete") return source;
  const solved = solveAssigned(deps, input);
  if (solved.kind !== "complete") return solved;
  if (solved.value.error !== null) return failedCall(deps, solved.value.error);
  const callLocations = prepareCallCaptures(deps, input, arena, source.value, solved.value.entry, solved.value.reachable,
    capturedLocals, captureLocations, cellLocals, bounded, contextReferences);
  if (callLocations.kind !== "complete") return callLocations;
  contextReferences = callLocations.value.references;
  lifetimeRecords = callLocations.value.lifetimes;
  const initialized = new Map<NodeId, Map<PlaceId, InitializationFact>>();
  const readIndices = new Map<NodeId, Map<PlaceId, number>>();
  let initializedCount = 0;
  const reads: ReadOriginsFact[] = [];
  const subjects: SubjectOriginsFact[] = [];
  const writes: WriteFact[] = [];
  const activations: BoundActivation[] = [];
  const invocations: InvocationFact[] = [];
  const escapes: EscapeFact[] = [];
  const retention: { readonly key: string; readonly value: SummaryRetention }[] = [];
  let returnAssigned: ReadonlySet<LocalId> | null = null;
  const writeInventory = chargeResultEntries(account, 1);
  if (writeInventory !== null) return writeInventory;
  const cellWrites = new Map<number, OriginsId>();
  let resultOrigins = empty;
  const admitUnion = (count: number, retain: boolean): DataflowStop | null => {
    const alternatives = bounded("maximumOriginAlternatives", count);
    if (alternatives !== null || !retain) return alternatives;
    const bound = bounded("maximumRelationalRecordsPerBody", 1, arena.cells.length + arena.boundProducers.length
        + arena.producers.length + arena.contexts.length + arena.origins.length + lifetimeRecords)
      ?? bounded("maximumRelationalReferencesPerBody", count, contextReferences);
    if (bound !== null) return bound;
    contextReferences += count;
    return null;
  };
  const initializationPoints: InitializationPoint[] = [];
  const initializationState: InitializationRow[] = [];
  const need = (cell: number, point: MirPoint, witness: Extract<InitializationPoint, { readonly kind: "need" }>["witness"],
    assigned: ReadonlySet<LocalId>): DataflowStop | null => recordInitializationPoint(deps, initializationPoints, initializationState,
      { kind: "need", at: { kind: "body", execution, point, edge: null }, cell, witness }, capturedEntries, assigned);
  let currentOrigins: readonly OriginsId[] = localOrigins;
  const originsOf = (operand: MirOperand): OriginsId => operandOrigins(input, constantOrigins, currentOrigins, operand);
  const flow = hasReference ? solveValueOrigins(deps, input, arena, values.value, constantOrigins, initialOrigins,
    localOrigins, solved.value.reachable, admitUnion, callLocations.value.calls) : null;
  if (flow !== null && flow.kind !== "complete") return flow;
  const read = (operand: MirOperand, node: NodeId, assigned: ReadonlySet<LocalId>, point: MirPoint): boolean => {
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
      if (chargeResultEntries(account, 3) !== null) return false;
      initializedCount += 1;
      occurrences.set(operand.place, { node, place: operand.place, assigned: present });
      let indices = readIndices.get(node);
      if (indices === undefined) { indices = new Map(); readIndices.set(node, indices); }
      indices.set(operand.place, reads.length);
      reads.push({ node, place: operand.place, origins: originsOf(operand) });
    } else {
      const index = requirePresent(readIndices.get(node)?.get(operand.place), { owner: "analyses/body", query: null, origin: null,
        message: "A repeated actual read retains its existing source-and-place row." });
      const previousRead = requirePresent(reads[index], { owner: "analyses/body", query: null, origin: null,
        message: "A repeated actual read retains its actual Origins row." });
      const joined = joinOrigins(deps, values.value, previousRead.origins, originsOf(operand), admitUnion);
      if (typeof joined !== "number") return false;
      if (chargeResultEntries(account, 2) !== null) return false;
      reads[index] = { ...previousRead, origins: joined };
      occurrences.set(operand.place, { node, place: operand.place, assigned: previous.assigned && present });
    }
    const cell = capturedLocals.get(local);
    if (!present && cell !== undefined) {
      return need(cell, point, { read: { kind: "body", value: { body: tir.body, node } }, via: [] }, assigned) === null;
    }
    return present;
  };
  for (const block of mir.blocks) {
    const blockWork = chargeWork(account, 1);
    if (blockWork !== null) return blockWork;
    if (solved.value.reachable[block.id] !== true) continue;
    if (solved.value.entry[block.id] === null) continue;
    currentOrigins = flow === null ? localOrigins : requirePresent(flow.value.get(block.id), { owner: "analyses/body", query: null,
      origin: block.origin, message: "A reached block retains its actual solved value-flow entry." });
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
        if (!read(operand, operandSite(source.value.get(statement.tir.node), index, statement.tir.node), assigned,
          { block: block.id, statement: position })) {
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
        const capture = capturedLocals.get(local);
        const transferred = transferValue(deps, input, constantOrigins, initialOrigins, currentOrigins, statement);
        if (transferred.kind !== "complete") return transferred;
        currentOrigins = transferred.value;
        const storeWork = chargeResultEntries(account, 3);
        if (storeWork !== null) return storeWork;
        if (capture !== undefined) {
          const retained = recordCaptureWrite(deps, input, local, capture, originsOf({ kind: "place", place: statement.place }), cellWrites, statement);
          if (retained !== null) return retained;
        }
        writes.push({ point: { block: block.id, statement: position }, node: statement.tir.node,
          operation: capture !== undefined || assigned.has(local) ? "mutation" : "initialization", destination: "binding",
          targets: capture === undefined ? [] : [requirePresent(captureLocations[capture], { owner: "analyses/body", query: null,
            origin: statement.origin, message: "A captured write retains its actual root location subject." }).location], owner: null,
          values: [{ source: statement.tir, origins: originsOf({ kind: "place", place: statement.place }), reason: null }], boundaries: [] });
      }
      if (statement.kind !== "assign" && hasReference) {
        const transferred = transferValue(deps, input, constantOrigins, initialOrigins, currentOrigins, statement);
        if (transferred.kind !== "complete") return transferred;
        currentOrigins = transferred.value;
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
      const bound = bounded("maximumRelationalRecordsPerBody", arena.cells.length + arena.boundProducers.length
        + arena.producers.length + arena.contexts.length + arena.origins.length + lifetimeRecords + 1)
        ?? bounded("maximumRelationalReferencesPerBody", terminator.arguments.length, contextReferences);
      if (bound !== null) return bound;
      contextReferences += terminator.arguments.length;
      const growth = chargeWork(account, 1) ?? chargeResultEntries(account, 6);
      if (growth !== null) return growth;
      const arguments_: OriginsId[] = [];
      const transports: ArgumentTransport[] = [];
      const callCaptures = terminator.callee.kind !== "body" ? [] : requirePresent(callLocations.value.calls.get(block.id), {
        owner: "analyses/body", query: null, origin: terminator.origin, message: "An executing body call retains its actual slot-location inventory." });
      const entryBindings: ValueEntryBinding[] = [];
      const cellBindings: (SummaryApplicationInput["cells"][number] & { readonly kind: "cell" })[] = [];
      for (const cell of selected.value.arena.cells) {
        const work = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
        if (work !== null) return work;
        const actual = cell.role.kind === "capture" ? callCaptures[cell.role.index] : undefined;
        if (actual === undefined) return bodyFrontier("A selected callee cell requires its actual capture or created-cell binding.");
        cellBindings.push({ kind: "cell", index: actual.cell });
      }
      for (const bound of selected.value.arena.boundProducers) {
        const work = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
        if (work !== null) return work;
        const producer = selected.value.arena.producers[bound.producer];
        const capture = producer?.kind === "capture" && producer.path === null && terminator.callee.kind === "body"
          ? terminator.callee.captures[producer.index] : undefined;
        if (capture !== undefined) entryBindings.push({ formal: bound.id, actual: originsOf({ kind: "place", place: capture.place }) });
        else if (producer?.kind === "parameter" && producer.path === null && terminator.callee.kind === "direct") {
          const argument = scalarArgument(deps, terminator, producer.index);
          if (argument.kind !== "complete") return argument;
          entryBindings.push({ formal: bound.id, actual: originsOf(argument.value) });
        } else return bodyFrontier("A selected callee entry value requires its actual root argument or capture transport.");
      }
      if (terminator.callee.kind === "direct") {
        const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
        if (setup !== null) return setup;
        const formals = new Map<number, ProducerId>();
        for (const producer of selected.value.arena.producers) {
          const formalWork = chargeWork(account, 1);
          if (formalWork !== null) return formalWork;
          if (producer.kind !== "parameter") continue;
          const row = chargeResultEntries(account, 1);
          if (row !== null) return row;
          formals.set(producer.index, producer.id);
        }
        const syntax = source.value.get(terminator.tir.node);
        const application = syntax?.kind === "CallExpression" || syntax?.kind === "NewExpression" ? syntax.tsonic?.application : null;
        if (application?.kind !== "decided")
          return bodyFrontier("A selected direct call retains its actual source application and argument occurrences.");
        const signatureRead = chargeWork(account, 1);
        if (signatureRead !== null) return signatureRead;
        const signature = deps.signatureOf(terminator.callee.resolution.decision.api.signature);
        const signatureStop = accountFailure(account);
        if (signatureStop !== null) return signatureStop;
        for (let index = 0; index < terminator.arguments.length; index += 1) {
          const argumentWork = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
          if (argumentWork !== null) return argumentWork;
          const argument = scalarArgument(deps, terminator, index);
          if (argument.kind !== "complete") return argument;
          const sourceArgument = application.decision.arguments[index];
          const parameter = requirePresent(signature.parameters[index], { owner: "analyses/body", query: null, origin: terminator.origin,
            message: "An actual fixed call retains every selected signature parameter." });
          if (sourceArgument?.kind !== "provided" || sourceArgument.parameter !== index)
            return bodyFrontier("A selected fixed argument retains its actual provided occurrence and formal declaration.");
          if (!read(argument.value, sourceArgument.expression, assigned, { block: block.id, statement: null })) {
            const stop = accountFailure(account);
            if (stop !== null) return stop;
            const failure = chargeWork(account, 5) ?? chargeResultEntries(account, 8);
            return failure ?? { kind: "complete", value: uninitialized(deps, terminator) };
          }
          const origins = originsOf(argument.value);
          arguments_.push(origins);
          transports.push({ authoredIndex: index, parameter: parameter.declaration, parameterIndex: index, repeated: false,
            passing: "by-value", actual: origins, formal: { owner: { kind: "summary", key: selected.value.key },
              producer: requirePresent(formals.get(index), { owner: "analyses/body", query: null, origin: terminator.origin,
                message: "A selected scalar call retains its actual callee formal producer." }) }, projection: null });
        }
      }
      const context = valueContextId(contexts.length);
      contexts.push({ id: context, receiver: null, arguments: arguments_, captures: callCaptures });
      const point = { block: block.id, statement: null };
      const applied = applyScalarCall(deps, input, terminator, point, selected.value, arena, context, entryBindings, cellBindings);
      if (applied.kind !== "complete") return applied;
      for (const write of applied.value.writes) {
        const read = chargeWork(account, 1);
        if (read !== null) return read;
        const target = write.target.targets[0];
        const value = appliedOrigins(deps, values.value, write.value, admitUnion);
        if (typeof value !== "number") return value;
        const growth = chargeResultEntries(account, cellWrites.has(target.cell) ? 0 : 1);
        if (growth !== null) return growth;
        cellWrites.set(target.cell, value);
      }
      let callResult = empty;
      if (hasReference || applied.value.result.includesAbsence) {
        const result = appliedOrigins(deps, values.value, applied.value.result, admitUnion);
        if (typeof result !== "number") return result;
        callResult = result;
      }
      if (terminator.destination !== null) {
        const written = chargeWork(account, currentOrigins.length) ?? chargeResultEntries(account, currentOrigins.length);
        if (written !== null) return written;
        const next = [...currentOrigins];
        next[readLocal(mir, { kind: "place", place: terminator.destination })] = callResult;
        currentOrigins = next;
      }
      let witnessRows: Map<InitializationPoint, number> | null = null;
      for (const row of applied.value.initialization) {
        const work = chargeWork(account, 1);
        if (work !== null) return work;
        if (row.point.kind !== "need" || row.condition.alternatives.length !== 0) continue;
        const read = chargeWork(account, 3);
        if (read !== null) return read;
        const sourceCell = requirePresent(selected.value.initialization.cells[row.point.cell], { owner: "analyses/body", query: null, origin: terminator.origin,
          message: "An applied need retains its actual source cell selector." });
        const binding = requirePresent(cellBindings[sourceCell], { owner: "analyses/body", query: null, origin: terminator.origin,
          message: "An applied need retains its actual caller cell binding." });
        const local = requirePresent(cellLocals[binding.index], { owner: "analyses/body", query: null, origin: terminator.origin,
          message: "An applied need retains its actual executing local." });
        if (assigned.has(local)) continue;
        const incoming = capturedLocals.get(local);
        if (incoming === undefined) {
          const failure = chargeWork(account, 5) ?? chargeResultEntries(account, 8);
          return failure ?? { kind: "complete", value: uninitialized(deps, terminator) };
        }
        if (witnessRows === null) {
          const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
          if (setup !== null) return setup;
          witnessRows = new Map();
          for (let index = 0; index < selected.value.initialization.rows.length; index += 1) {
            const work = chargeWork(account, 1);
            if (work !== null) return work;
            const source = requirePresent(selected.value.initialization.rows[index], { owner: "analyses/body", query: null, origin: terminator.origin,
              message: "A verified summary retains every actual initialization row." });
            const sourcePoint = requirePresent(selected.value.initialization.points[source.point], { owner: "analyses/body", query: null, origin: terminator.origin,
              message: "A verified initialization row retains its actual point." });
            if (source.cell !== null || sourcePoint.kind !== "need") continue;
            const growth = chargeResultEntries(account, 1);
            if (growth !== null) return growth;
            witnessRows.set(sourcePoint, index);
          }
        }
        const source = requirePresent(witnessRows.get(row.point), { owner: "analyses/body", query: null, origin: terminator.origin,
          message: "An applied need retains its actual source summary read-point row." });
        const witness = row.point.witness;
        const state = sourceNeedAssigned(deps, selected.value, source, cellBindings, cellLocals, assigned);
        if (state.kind !== "complete") return state;
        const growth = chargeWork(account, witness.via.length + 1) ?? chargeResultEntries(account, witness.via.length + 2);
        if (growth !== null) return growth;
        const propagated = need(incoming, point, { read: witness.read, via: [{ key: selected.value.key, row: source }, ...witness.via] }, state.value);
        if (propagated !== null) return propagated;
      }
      activations.push({ node: terminator.tir.node, point, activation: callInstance(terminator), context,
        caller: valueContextId(0), entry: null });
      if (terminator.callee.kind === "direct") {
        const invocationWork = chargeWork(account, 1) ?? chargeResultEntries(account, 6);
        if (invocationWork !== null) return invocationWork;
        const signature = deps.signatureOf(terminator.callee.resolution.decision.api.signature);
        const signatureStop = accountFailure(account);
        if (signatureStop !== null) return signatureStop;
        invocations.push({ node: terminator.tir.node, point, kind: signature.kind, alternatives: [{
          resolution: terminator.callee.resolution, context, arguments: transports,
          result: callResult,
          thrown: empty, summary: selected.value.key }], boundaries: [] });
      }
      if (selected.value.returns && terminator.destination !== null) {
        const local = readLocal(mir, { kind: "place", place: terminator.destination });
        const capture = capturedLocals.get(local);
        if (capture !== undefined) {
          const retained = recordCaptureWrite(deps, input, local, capture, callResult, cellWrites, terminator);
          if (retained !== null) return retained;
        }
        const write = chargeResultEntries(account, 3);
        if (write !== null) return write;
        writes.push({ point, node: terminator.tir.node, operation: capture !== undefined || assigned.has(local) ? "mutation" : "initialization",
          destination: "binding", targets: capture === undefined ? [] : [requirePresent(captureLocations[capture], {
            owner: "analyses/body", query: null, origin: terminator.origin, message: "A captured call destination retains its actual root location." }).location], owner: null,
          values: [{ source: terminator.tir, origins: originsOf({ kind: "place", place: terminator.destination }), reason: null }], boundaries: [] });
      }
      continue;
    }
    for (const operand of terminatorOperands(terminator)) {
      if (!read(operand, operandSite(source.value.get(terminator.tir.node), 0, terminator.tir.node), assigned,
        { block: block.id, statement: null })) {
        const stop = accountFailure(account);
        if (stop !== null) return stop;
        const failure = chargeWork(account, 5) ?? chargeResultEntries(account, 8);
        return failure ?? { kind: "complete", value: uninitialized(deps, terminator) };
      }
    }
    if (terminator.kind === "return") {
      const state = captureMustAtExit(deps, capturedEntries, assigned, returnAssigned);
      if (state.kind !== "complete") return state;
      returnAssigned = state.value;
      if (terminator.value !== null) {
        const origins = originsOf(terminator.value);
        const joined = joinOrigins(deps, values.value, resultOrigins, origins, admitUnion);
        if (typeof joined !== "number") return joined;
        resultOrigins = joined;
        subjects.push({ node: terminator.tir.node, role: "return", path: null, origins });
        const returned = requirePresent(originRows[origins], { owner: "analyses/body", query: null, origin: terminator.origin,
          message: "A returned reference retains its actual bound Origins." });
        if (returned.producers.length !== 0) {
          const identity = admitSummaryIdentity({ kind: "body", execution }, account)
            ?? chargeWork(account, 4) ?? chargeResultEntries(account, 2);
          if (identity !== null) return identity;
          const point = { block: block.id, statement: null };
          const at = { kind: "body", execution, point, edge: null } satisfies SummaryRetention["at"];
          const key = summaryPositionKey(at);
          for (const source of returned.producers) {
            const row = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
            if (row !== null) return row;
            const bound = requirePresent(boundProducers[source], { owner: "analyses/body", query: null, origin: terminator.origin,
              message: "A returned reference names its actual bound value producer." });
            escapes.push({ point, node: terminator.tir.node, producer: bound.producer, target: { kind: "return" } });
            retention.push({ key, value: { source, at, into: { kind: "return" } } });
          }
        }
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
  const escapeRows = orderedRows(escapes, (left, right) => left.point.block - right.point.block, account);
  if (escapeRows.kind !== "complete") return escapeRows;
  const retentionRows = orderedRows(retention, (left, right) => {
    if (left.value.source !== right.value.source) return left.value.source - right.value.source;
    if (chargeWork(account, Math.min(left.key.length, right.key.length)) !== null) return 0;
    return left.key < right.key ? -1 : 1;
  }, account);
  if (retentionRows.kind !== "complete") return retentionRows;
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
  const completion = chargeWork(account, capturedEntries.length + boundProducers.length)
    ?? chargeResultEntries(account, capturedEntries.length * 6 + retentionRows.value.length + 5);
  if (completion !== null) return completion;
  const returns = returnAssigned !== null;
  if (returnAssigned !== null) {
    const returned = recordInitializationPoint(deps, initializationPoints, initializationState, { kind: "return" }, capturedEntries, returnAssigned);
    if (returned !== null) return returned;
  }
  const written = collectCellWrites(deps, cells.length, capturedEntries.length, cellWrites);
  if (written.kind !== "complete") return written;
  const projected = contexts.length === 1 ? null : chargeWork(account, formalCount + capturedEntries.length + entryBoundCount)
    ?? chargeResultEntries(account, formalCount + capturedEntries.length + entryBoundCount + 1);
  if (projected !== null) return projected;
  const summaryArena = contexts.length === 1 ? arena : { ...arena, producers: producers.slice(0, formalCount + capturedEntries.length), cells: cells.slice(0, capturedEntries.length),
    boundProducers: boundProducers.slice(0, entryBoundCount), contexts: [requirePresent(contexts[0],
      { owner: "analyses/body", query: null, origin: null, message: "A scalar boundary projection retains its actual entry context." })] };
  const summary: Summary = { key: { kind: "body", execution }, signature: tir.signature, arena: summaryArena,
    parameters: [], captures: capturedEntries.map((_, index) => ({ index, reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } })),
    result: resultOrigins, thrown: empty, writes: written.value.boundary, retention: retentionRows.value.map(row => row.value), callbacks: [],
    concurrentWrites: [], contentsOnReturn: returns ? written.value.boundary : [], contentsOnUnwind: [], returns, unwinds: false,
    initialization: { cells: capturedEntries.map((_, index) => index), events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }],
      points: initializationPoints, rows: initializationState },
    resultCells: [], backing: [], suspends: false, bindingDependent: tir.dependence === "binding-dependent" };
  const effects: Summary["parameters"][number][] = [];
  if (signature.receiver !== null) effects.push({ slot: { kind: "receiver" }, reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } });
  for (let index = 0; index < signature.parameters.length; index += 1) effects.push({ slot: { kind: "parameter", index },
    reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } });
  const value: BodyRoundValue = { facts: { execution, arena, liveness, initialization: { reads: initialization.value },
    refinements: { refinements: [], integers: integerRows.value, countedLoops: [] }, origins: { points: [], reads: readRows.value,
      subjects: subjectRows.value, writes, escapes: escapeRows.value, invocations, callbacks: [], activations, frontiers: [],
      constructions: [], instanceRegions: [], exitContents: { onReturn: returns ? written.value.body : [], onUnwind: [] } },
    suspension: { suspensions: [] }, errorStorage: { errors: [] }, pointerBacking: { pointers: [] }, rawLocations: [],
    fieldBindings: [], recordBindings: [], memoryBindings: [], selectedMemoryDeclarations: [], closedArrays: [] },
    summary: { ...summary, parameters: effects } };
  return { kind: "complete", value: { kind: "ok", value, diagnostics: [], emissions: [], positions: [{ position: { kind: "result" }, error: null }] } };
}
