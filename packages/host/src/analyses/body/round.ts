import type { DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, refuseAccount } from "../../dataflow/index.js";
import type { Diagnostic, DiagnosticIdentity, ErrorValue, UnitResult } from "../../diag/contract.js";
import { hostDiagnosticCode, requirePresent, resourceLimitDiagnostic } from "../../diag/index.js";
import type { LocalId, NodeId, OriginsId, PlaceId, ProducerId, TyId } from "../../ids/contract.js";
import { boundProducerId, originsId, producerId, valueContextId } from "../../ids/index.js";
import type { ArgumentTransport, BoundActivation, BoundProducer, CaptureLocation, InitializationFact, InitializationPoint, InitializationRow, IntegerFact, InvocationFact, LogicalCellRow, MirPoint, Producer, ReadOriginsFact, SubjectOriginsFact, Summary, SummaryApplicationInput, ValueContext, ValueEntryBinding, WriteFact } from "../../ir-facts/contract.js";
import { admitSummaryIdentity } from "../../ir-facts/index.js";
import type { MirOperand, MirSite } from "../../ir-mir/contract.js";
import { localOwnershipOfMir } from "../../ir-mir/index.js";
import type { TirNode } from "../../ir-tir/contract.js";
import { nativeCarrierOf, sameInstance } from "../../ir-types/index.js";
import type { BodyRoundDeps, BodyRoundInput, BodyRoundResult, BodyRoundValue } from "./contract.js";
import type { CallError } from "./calls.js";
import { applyScalarCall, callInstance, callSummary, isCallError, scalarArgument } from "./calls.js";
import { orderedRows, sourceOccurrences } from "./source.js";
import type { LocalSlotEvidence } from "./storage.js";
import { assignedEntry, bodyFrontier, localSlotEvidence, readLocal, solveAssigned, statementOperands, terminatorOperands, transferAssigned } from "./storage.js";

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
    ?? chargeResultEntries(account, 15 + mir.locals.length + mir.constants.length);
  if (setup !== null) return setup;
  const capturedLocals = new Map<number, number>();
  const capturedEntries: LocalId[] = [];
  const cells: LogicalCellRow[] = [];
  const boundProducers: BoundProducer[] = [];
  const captureLocations: CaptureLocation[] = [];
  const callerCaptures = new Map<LocalId, CaptureLocation>();
  const cellLocals: LocalId[] = [];
  const empty = originsId(0);
  const absent = originsId(1);
  const localOrigins: OriginsId[] = [];
  const constantOrigins: OriginsId[] = [];
  const parameterOrigins: OriginsId[] = [];
  let receiverOrigins: OriginsId | null = null;
  let hasAbsence = false;
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
  if (capturedLocals.size !== tir.captures.length)
    return bodyFrontier("BodyAnalysis requires the actual Origins capture-to-cell association for every selected captured execution slot.");
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
  const signatureStop = accountFailure(account);
  if (signatureStop !== null) return signatureStop;
  const summaryWork = chargeResultEntries(account, 40 + signature.parameters.length * 4);
  if (summaryWork !== null) return summaryWork;
  const bounded = (limit: "maximumRelationalRecordsPerBody" | "maximumRelationalReferencesPerBody" | "maximumConditionAlternatives",
    size: number, retained = 0): DataflowStop | null =>
    size <= deps.limits[limit] - retained ? null : refuseAccount(account, { kind: "refused", diagnostics: [
      resourceLimitDiagnostic({ owner: "analyses/origins", limit: `analysis.${limit}`, maximum: deps.limits[limit],
        site: { kind: "source", origin: tir.root.origin }, unit: { request: deps.unit, position: { kind: "result" } } })] });
  const formalCount = signature.parameters.length + (signature.receiver === null ? 0 : 1);
  let contextReferences = formalCount + tir.captures.length * 5;
  const bound = bounded("maximumRelationalRecordsPerBody", 2 + formalCount + tir.captures.length * 3 + (hasAbsence ? 1 : 0))
    ?? bounded("maximumRelationalReferencesPerBody", contextReferences)
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
  }
  const argumentWork = chargeWork(account, signature.parameters.length) ?? chargeResultEntries(account, hasAbsence ? 1 : 0);
  if (argumentWork !== null) return argumentWork;
  const contexts: ValueContext[] = [{ id: valueContextId(0), receiver: signature.receiver === null ? null
    : requirePresent(receiverOrigins, { owner: "analyses/body", query: null, origin: null, message: "A selected receiver retains its actual scalar origins." }),
    arguments: signature.parameters.map((_, index) => requirePresent(parameterOrigins[index],
      { owner: "analyses/body", query: null, origin: null, message: "Every actual selected formal retains its scalar origins." })), captures: captureLocations }];
  const arena = { cells, projections: [], producers, boundProducers, boundaries: [], contexts,
    origins: hasAbsence ? [{ id: empty, kind: "complete", producers: [], includesAbsence: false },
      { id: absent, kind: "complete", producers: [], includesAbsence: true }]
      : [{ id: empty, kind: "complete", producers: [], includesAbsence: false }] } satisfies BodyRoundValue["facts"]["arena"];
  const source = sourceOccurrences(tir, account);
  if (source.kind !== "complete") return source;
  const solved = solveAssigned(deps, input);
  if (solved.kind !== "complete") return solved;
  if (solved.value.error !== null) return failedCall(deps, solved.value.error);
  let localSlots: ReadonlyMap<LocalId, LocalSlotEvidence> | null = null;
  const initialized = new Map<NodeId, Map<PlaceId, InitializationFact>>();
  let initializedCount = 0;
  const reads: ReadOriginsFact[] = [];
  const subjects: SubjectOriginsFact[] = [];
  const writes: WriteFact[] = [];
  const activations: BoundActivation[] = [];
  const invocations: InvocationFact[] = [];
  let returns = false;
  let resultOrigins = empty;
  const initializationPoints: InitializationPoint[] = [];
  const initializationState: InitializationRow[] = [];
  const need = (cell: number, point: MirPoint, witness: Extract<InitializationPoint, { readonly kind: "need" }>["witness"]): DataflowStop | null => {
    const growth = chargeWork(account, 1) ?? chargeResultEntries(account, 4);
    if (growth !== null) return growth;
    const position = initializationPoints.length;
    initializationPoints.push({ kind: "need", at: { kind: "body", execution, point, edge: null }, cell, witness });
    initializationState.push({ point: position, cell: null, condition: 0 });
    return null;
  };
  const originsOf = (operand: MirOperand): OriginsId => requirePresent(operand.kind === "constant" ? constantOrigins[operand.constant]
    : localOrigins[readLocal(mir, operand)], { owner: "analyses/body", query: null, origin: null,
      message: "A verified scalar operand retains its actual absence disposition." });
  const read = (operand: MirOperand, node: NodeId, assigned: ReadonlySet<number>, point: MirPoint): boolean => {
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
    const cell = capturedLocals.get(local);
    if (!present && cell !== undefined) {
      return need(cell, point, { read: { kind: "body", value: { body: tir.body, node } }, via: [] }) === null;
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
        if (capturedLocals.has(local))
          return bodyFrontier("BodyAnalysis requires the actual captured-cell content and exit-write transport for this assignment.");
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
      const bound = bounded("maximumRelationalRecordsPerBody", arena.cells.length + arena.boundProducers.length
        + arena.producers.length + arena.contexts.length + arena.origins.length + 1)
        ?? bounded("maximumRelationalReferencesPerBody", terminator.arguments.length, contextReferences);
      if (bound !== null) return bound;
      contextReferences += terminator.arguments.length;
      const growth = chargeWork(account, 1) ?? chargeResultEntries(account, 6);
      if (growth !== null) return growth;
      const arguments_: OriginsId[] = [];
      const transports: ArgumentTransport[] = [];
      const callCaptures: CaptureLocation[] = [];
      const entryBindings: ValueEntryBinding[] = [];
      const cellBindings: (SummaryApplicationInput["cells"][number] & { readonly kind: "cell" })[] = [];
      if (terminator.callee.kind === "body") {
        for (let index = 0; index < terminator.callee.captures.length; index += 1) {
          const captureWork = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
          if (captureWork !== null) return captureWork;
          const capture = requirePresent(terminator.callee.captures[index], { owner: "analyses/body", query: null, origin: terminator.origin,
            message: "A selected body call retains every actual capture transport." });
          const local = readLocal(mir, { kind: "place", place: capture.place });
          const incoming = capturedLocals.get(local);
          let binding = incoming === undefined ? callerCaptures.get(local) : captureLocations[incoming];
          if (binding === undefined) {
            const bound = bounded("maximumRelationalRecordsPerBody", arena.cells.length + arena.boundProducers.length
              + arena.producers.length + arena.contexts.length + arena.origins.length + 4)
              ?? bounded("maximumRelationalReferencesPerBody", 5, contextReferences);
            if (bound !== null) return bound;
            const growth = chargeWork(account, 2) ?? chargeResultEntries(account, 12);
            if (growth !== null) return growth;
            const source = requirePresent(mir.locals[local], { owner: "analyses/body", query: null, origin: terminator.origin,
              message: "A verified capture retains its actual executing local." });
            if (source.role.kind !== "parameter" && source.role.kind !== "receiver" && source.role.kind !== "user")
              return bodyFrontier("BodyAnalysis requires the actual local lifetime and value-subject binding for this captured slot.");
            if (source.source === null || source.source.body !== tir.body || tir.locals[source.source.local]?.id !== source.source.local)
              return bodyFrontier("A captured caller slot retains its actual qualified source local, not its formal value identity.");
            const cell = cells.length;
            const location = boundProducerId(boundProducers.length);
            const producer = producerId(producers.length);
            let slot: LocalSlotEvidence | undefined;
            if (source.role.kind === "user") {
              if (localSlots === null) {
                const evidence = localSlotEvidence(input, solved.value.reachable, account);
                if (evidence.kind !== "complete") return evidence;
                localSlots = evidence.value;
              }
              const lookup = chargeWork(account, 1);
              if (lookup !== null) return lookup;
              slot = localSlots.get(local);
              if (slot === undefined || slot.starts.length !== 1)
                return bodyFrontier("BodyAnalysis requires the actual reaching storage-start relation for this captured local slot.");
            }
            cells.push({ id: cell, role: { kind: "local", local }, occurrence: slot === undefined
              ? { kind: "entry", execution, local } : { kind: "statement", execution,
                point: requirePresent(slot.starts[0], { owner: "analyses/body", query: null, origin: terminator.origin,
                  message: "A captured local slot retains its actual verified storage-start occurrence." }) }, lifetimes: slot?.lifetimes ?? [] });
            cellLocals.push(local);
            producers.push({ id: producer, path: null, kind: "local", local: source.source });
            boundProducers.push({ id: location, producer, bindings: tir.lexicalBindings, context: valueContextId(0) });
            binding = { index, location, cell };
            callerCaptures.set(local, binding);
            contextReferences += 5;
          }
          const references = bounded("maximumRelationalReferencesPerBody", 2, contextReferences);
          if (references !== null) return references;
          contextReferences += 2;
          callCaptures.push({ index, location: binding.location, cell: binding.cell });
        }
      }
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
        if (capture === undefined) return bodyFrontier("A selected callee entry value requires its actual root capture transport.");
        entryBindings.push({ formal: bound.id, actual: originsOf({ kind: "place", place: capture.place }) });
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
        const growth = chargeWork(account, witness.via.length + 1) ?? chargeResultEntries(account, witness.via.length + 2);
        if (growth !== null) return growth;
        const propagated = need(incoming, point, { read: witness.read, via: [{ key: selected.value.key, row: source }, ...witness.via] });
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
          result: terminator.destination === null ? empty : originsOf({ kind: "place", place: terminator.destination }),
          thrown: empty, summary: selected.value.key }], boundaries: [] });
      }
      if (selected.value.returns && terminator.destination !== null) {
        const local = readLocal(mir, { kind: "place", place: terminator.destination });
        if (capturedLocals.has(local))
          return bodyFrontier("BodyAnalysis requires the actual captured-cell content and exit-write transport for this call destination.");
        const write = chargeResultEntries(account, 3);
        if (write !== null) return write;
        writes.push({ point, node: terminator.tir.node, operation: assigned.has(local) ? "mutation" : "initialization",
          destination: "binding", targets: [], owner: null,
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
  const completion = chargeWork(account, capturedEntries.length + boundProducers.length)
    ?? chargeResultEntries(account, capturedEntries.length * 6 + 5);
  if (completion !== null) return completion;
  if (returns) {
    initializationState.push({ point: initializationPoints.length, cell: null, condition: 0 });
    initializationPoints.push({ kind: "return" });
  }
  const projected = contexts.length === 1 ? null : chargeWork(account, formalCount + capturedEntries.length)
    ?? chargeResultEntries(account, formalCount + capturedEntries.length + 1);
  if (projected !== null) return projected;
  const summaryArena = contexts.length === 1 ? arena : { ...arena, producers: producers.slice(0, formalCount + capturedEntries.length), cells: cells.slice(0, capturedEntries.length),
    boundProducers: boundProducers.slice(0, capturedEntries.length), contexts: [requirePresent(contexts[0],
      { owner: "analyses/body", query: null, origin: null, message: "A scalar boundary projection retains its actual entry context." })] };
  const summary: Summary = { key: { kind: "body", execution }, signature: tir.signature, arena: summaryArena,
    parameters: [], captures: capturedEntries.map((_, index) => ({ index, reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } })),
    result: resultOrigins, thrown: empty, writes: [], retention: [], callbacks: [],
    concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [], returns, unwinds: false,
    initialization: { cells: capturedEntries.map((_, index) => index), events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }],
      points: initializationPoints, rows: initializationState },
    resultCells: [], backing: [], suspends: false, bindingDependent: tir.dependence === "binding-dependent" };
  const effects: Summary["parameters"][number][] = [];
  if (signature.receiver !== null) effects.push({ slot: { kind: "receiver" }, reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } });
  for (let index = 0; index < signature.parameters.length; index += 1) effects.push({ slot: { kind: "parameter", index },
    reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } });
  const value: BodyRoundValue = { facts: { execution, arena, liveness, initialization: { reads: initialization.value },
    refinements: { refinements: [], integers: integerRows.value, countedLoops: [] }, origins: { points: [], reads: readRows.value,
      subjects: subjectRows.value, writes, escapes: [], invocations, callbacks: [], activations, frontiers: [],
      constructions: [], instanceRegions: [], exitContents: { onReturn: [], onUnwind: [] } },
    suspension: { suspensions: [] }, errorStorage: { errors: [] }, pointerBacking: { pointers: [] }, rawLocations: [],
    fieldBindings: [], recordBindings: [], memoryBindings: [], selectedMemoryDeclarations: [], closedArrays: [] },
    summary: { ...summary, parameters: effects } };
  return { kind: "complete", value: { kind: "ok", value, diagnostics: [], emissions: [], positions: [{ position: { kind: "result" }, error: null }] } };
}
