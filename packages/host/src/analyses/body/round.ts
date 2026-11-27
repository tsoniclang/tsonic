import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, refuseAccount } from "../../dataflow/index.js";
import { requirePresent, resourceLimitDiagnostic } from "../../diag/index.js";
import type { BoundProducerId, LocalId, NodeId, OriginsId, PlaceId, ProducerId, ProjectionPathId } from "../../ids/contract.js";
import { boundProducerId, originsId, producerId, valueContextId } from "../../ids/index.js";
import type { ArgumentTransport, BoundActivation, BoundInitializationRow, BoundProducer, CaptureBinding, CaptureLocation, CountedLoopProofs, EffectPaths, InitializationFact, InitializationPoint, InitializationRow, IntegerFact, InvocationFact, LogicalCellRow, MirPoint, OpenBoundary, Origins, Producer, ReadOriginsFact, SubjectOriginsFact, Summary, ValueArgument, ValueContext, ValueEntryBinding, WriteFact } from "../../ir-facts/contract.js";
import { admitSummaryIdentity, countedLoopsOf } from "../../ir-facts/index.js";
import type { MirLocal, MirOperand, MirPlace, MirTerminator } from "../../ir-mir/contract.js";
import { localOwnershipOfMir } from "../../ir-mir/index.js";
import type { TirArgument, TirSyntaxOccurrence } from "../../ir-tir/contract.js";
import { sameInstance } from "../../ir-types/index.js";
import type { BodyRoundDeps, BodyRoundInput, BodyRoundResult, BodyRoundValue } from "./contract.js";
import type { CallError } from "./calls.js";
import { applyScalarCall, bindCallInitialization, callCaptureBindings, callCellIndex, callInstance, isCallError, isLeastCall, scalarArgument } from "./calls.js";
import { orderedRows, sourceOccurrences } from "./source.js";
import { assignedEntry, selectedCallAt, solveAssigned, statementOperands, terminatorOperands, transferAssigned, unwrittenCause } from "./storage.js";
import type { AssignedState } from "./storage.js";
import { prepareCallCaptures } from "./captures.js";
import { noCallBoundaries, noCallBoundary, openCallTransport } from "./open-calls.js";
import { bodyFrontier, staticCells, readLocal, rootSlot } from "./places.js";
import { projectionEffects as createProjectionEffects, heldProjections } from "./projection-effects.js";
import type { StaticCells } from "./places.js";
import { staticCallInventory } from "./static-calls.js";
import type { StaticCalleeCells, StaticCallInventory } from "./static-calls.js";
import { appliedOrigins, joinOrigins, valueKind, valueOrigins } from "./values.js";
import { applyExitContents, collectExitContents, operandOrigins, removeUnchangedContents, solveValueOrigins, transferValue } from "./value-flow.js";
import { callExitAssigned, cellMustAtExit, initializationError, recordInitializationPoint, recordUninitializedRead, sourceNeedAssigned } from "./initialization.js";
import type { PlacedInitializationRead, UninitializedRead } from "./initialization.js";
import { collectCellWrites, recordCaptureWrite, recordCellWrite } from "./writes.js";
import { collectRetainedValues, retainCallCaptures, retainValue } from "./exits.js";
import type { ValueEscape, ValueRetention } from "./exits.js";

const noCountedProofs: { readonly kind: "complete"; readonly value: CountedLoopProofs } = {
  kind: "complete", value: { loops: [], ranges: [], refinements: [] },
};

function operandSite(node: TirSyntaxOccurrence | undefined, position: number, dispatch: boolean): TirSyntaxOccurrence | undefined {
  if (dispatch) {
    switch (node?.kind) {
      case "IfStatement": case "WhileStatement": case "DoStatement": case "SwitchStatement": return node.expression;
      case "ForStatement": return node.condition ?? undefined;
      case "ConditionalExpression": return node.condition;
    }
  }
  if (node?.kind === "BinaryExpression") {
    if (!dispatch && node.tsonic.role === "assignment" && node.tsonic.calculation === null) return node.right;
    if (!dispatch && node.tsonic.role === "sequence") return node;
    return position === 0 ? node.left : node.right;
  }
  if (node?.kind === "PrefixUnaryExpression" || node?.kind === "PostfixUnaryExpression") return node.operand;
  if (node?.kind === "PropertyAccessExpression" && node.tsonic.role === "array-extent") return node.expression;
  if (node?.kind === "ReturnStatement" && node.expression !== null) return node.expression;
  if (node?.kind === "ThrowStatement") return node.expression;
  return node;
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
  const capturedLocals = new Map<number, CaptureLocation>();
  const capturedEntries: { readonly local: LocalId; readonly mode: "captured-value" | "captured-location" }[] = [];
  let capturesChecked = 0;
  let locationCaptureCount = 0;
  const cells: LogicalCellRow[] = [];
  const boundProducers: BoundProducer[] = [];
  const cellLocals: number[] = [];
  const empty = originsId(0);
  const absent = originsId(1);
  const localOrigins: OriginsId[] = [];
  const constantOrigins: OriginsId[] = [];
  const parameterOrigins: OriginsId[] = [];
  const valueEntries: { readonly local: LocalId; readonly role: Extract<MirLocal["role"], { readonly kind: "parameter" | "receiver" }>;
    readonly copied: boolean }[] = [];
  let copiedEntries: Set<BoundProducerId> | null = null;
  const retainCopiedEntry = (bound: BoundProducerId): DataflowStop | null => {
    const copy = chargeWork(account, 1) ?? chargeResultEntries(account, copiedEntries === null ? 2 : 1);
    if (copy !== null) return copy;
    copiedEntries ??= new Set();
    copiedEntries.add(bound);
    return null;
  };
  let receiverOrigins: OriginsId | null = null;
  let hasAbsence = false;
  let hasReference = false;
  let hasOptional = false;
  let valueCaptureCount = 0;
  let staticPlaces: MirPlace[] | null = null;
  let projectedPlaces: MirPlace[] | null = null;
  for (const place of mir.places) {
    if (place.base.kind === "static") {
      const growth = chargeResultEntries(account, staticPlaces === null ? 2 : 1);
      if (growth !== null) return growth;
      staticPlaces ??= [];
      staticPlaces.push(place);
    } else if (place.base.kind === "place" && place.base.projection.kind === "field"
      || place.base.kind === "checked" && place.base.projection.kind === "index") {
      const growth = chargeResultEntries(account, projectedPlaces === null ? 2 : 1);
      if (growth !== null) return growth;
      projectedPlaces ??= [];
      projectedPlaces.push(place);
    } else if (place.base.kind !== "local")
      return bodyFrontier("BodyAnalysis requires the actual selected projection or static-cell producer for this place.");
  }
  const preparedSource = projectedPlaces === null && staticPlaces === null ? null : sourceOccurrences(tir, account);
  if (preparedSource !== null && preparedSource.kind !== "complete") return preparedSource;
  const preparedProjections = preparedSource === null || projectedPlaces === null ? null : heldProjections(deps, input, preparedSource.value, projectedPlaces);
  if (preparedProjections !== null && preparedProjections.kind !== "complete") return preparedProjections;
  const projections = preparedProjections?.value ?? null;
  let referenceFormals: Map<number, "field" | "array"> | null = null;
  let objectValues: Set<LocalId> | null = null;
  for (const local of mir.locals) {
    if (local.role.kind === "capture") {
      const captureWork = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
      if (captureWork !== null) return captureWork;
      const capture = tir.captures[local.role.index];
      if (capture === undefined || capture.capture === null || local.mode !== capture.capture
        || local.source === null || local.source.body !== capture.local.body || local.source.local !== capture.local.local)
        return bodyFrontier("A capture retains its actual selected mode and qualified source storage.");
      if (capturedEntries[local.role.index] !== undefined)
        return bodyFrontier("An incoming capture has one actual executing local.");
      if (local.mode === "captured-location") locationCaptureCount += 1;
      capturedEntries[local.role.index] = { local: local.id, mode: capture.capture };
      capturesChecked += 1;
    } else if (localOwnershipOfMir(local.mode) !== "body")
      return bodyFrontier("BodyAnalysis requires the actual caller-cell binding of this external storage mode.");
    let kind: ReturnType<typeof valueKind>;
    if (local.role.kind === "exception") {
      const admit = chargeWork(account, 2);
      if (admit !== null) return admit;
      const selected = local.source?.body === tir.body ? tir.locals[local.source.local] : undefined;
      const type = deps.typeOf(local.storage);
      const stopped = accountFailure(account);
      if (stopped !== null) return stopped;
      if (selected?.role !== "catch" || selected.storage !== local.storage || type.kind !== "intrinsic" || type.intrinsic !== "unknown")
        return bodyFrontier("A caught payload retains its actual typed exception binding and selected storage.");
      kind = "reference";
    } else kind = projections?.references.has(local.id) === true ? "reference" : valueKind(deps, local.storage);
    const afterKind = accountFailure(account);
    if (afterKind !== null) return afterKind;
    if (kind === null && local.source !== null && (local.role.kind === "capture" ||
      local.source.body === tir.body && (local.role.kind === "parameter" && local.mode === "by-value" || local.role.kind === "user" && local.mode === "local"))) {
      const formal = deps.sourceObjectHolding(account, local.source, local.storage);
      if (formal.kind !== "complete") return formal;
      if (formal.value) {
        if (local.role.kind === "parameter") {
          const retained = chargeResultEntries(account, referenceFormals === null ? 2 : 1);
          if (retained !== null) return retained;
          referenceFormals ??= new Map();
          referenceFormals.set(local.role.index, "field");
        } else {
          const retained = chargeResultEntries(account, objectValues === null ? 2 : 1);
          if (retained !== null) return retained;
          objectValues ??= new Set();
          objectValues.add(local.id);
        }
        kind = "reference";
      }
    }
    if (kind === "array-reference" && local.role.kind === "parameter" && local.mode === "by-value") {
      const retained = chargeResultEntries(account, referenceFormals === null ? 2 : 1);
      if (retained !== null) return retained;
      referenceFormals ??= new Map();
      referenceFormals.set(local.role.index, "array");
    }
    if (kind === null) return bodyFrontier("BodyAnalysis requires the actual Origins reference/cell producer for this selected local.");
    if (kind === "primitive-optional" || kind === "reference-optional") {
      if (local.role.kind === "receiver")
        return bodyFrontier("BodyAnalysis requires the actual optional receiver value binding.");
      hasOptional = true;
    }
    if (kind === "reference" || kind === "array-reference" || kind === "reference-optional" || kind === "primitive-optional") {
      hasReference ||= kind !== "primitive-optional";
      if (local.role.kind === "capture") valueCaptureCount += 1;
      const entry = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
      if (entry !== null) return entry;
      if (local.role.kind === "parameter" && (local.role.index < 0 || !Number.isSafeInteger(local.role.index)
        || Object.is(local.role.index, -0) || local.role.index >= tir.params.length))
        return bodyFrontier("An incoming value retains its actual signature formal or receiver producer.");
      if (local.role.kind === "parameter" && local.role.index < execution.provided || local.role.kind === "receiver")
        valueEntries.push({ local: local.id, role: local.role, copied: kind === "primitive-optional" });
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
  let statics: StaticCells | null = null;
  let staticAbsence: Set<number> | null = null;
  if (staticPlaces !== null) {
    const source = requirePresent(preparedSource ?? undefined, { owner: "analyses/body", query: null, origin: tir.root.origin,
      message: "Selected static places require their actual source occurrences." });
    const prepared = staticCells(deps, input, source.value, locationCaptureCount);
    if (prepared.kind !== "complete") return prepared;
    statics = prepared.value;
    for (const place of staticPlaces) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const kind = valueKind(deps, place.storage);
      const stop = accountFailure(account);
      if (stop !== null) return stop;
      if (kind !== "primitive" && kind !== "primitive-optional" && kind !== "absence")
        return bodyFrontier("BodyAnalysis requires the actual selected non-scalar static content and retention producer.");
      if (kind === "primitive-optional" && statics.external.has(place.id))
        return bodyFrontier("An optional static read requires its actual incoming value contents.");
      if (kind === "absence") {
        const retain = chargeResultEntries(account, staticAbsence === null ? 2 : 1);
        if (retain !== null) return retain;
        const slot = requirePresent(statics.slots.get(place.id), { owner: "analyses/body", query: null,
          origin: place.origin, message: "A static absence cell retains its actual solver slot." });
        staticAbsence ??= new Set();
        staticAbsence.add(slot);
        hasAbsence = true;
      }
    }
  }
  const staticSlots = statics?.slots ?? null;
  if (capturesChecked !== tir.captures.length || capturedEntries.length !== capturesChecked)
    return bodyFrontier("BodyAnalysis requires the actual association for every selected captured execution slot.");
  for (const constant of mir.constants) {
    const kind = valueKind(deps, constant.type);
    if (constant.value.kind === "constant" && constant.value.reference.context === "enum-member") {
      const stopped = accountFailure(account) ?? chargeWork(account, 1);
      if (stopped !== null) return stopped;
      const ready = deps.enumValueOf(account, constant.value.reference);
      if (ready.kind !== "complete") return ready;
      const value = ready.value;
      if (value === null || value.type !== constant.type || kind !== "primitive"
        || value.kind !== "number" && value.kind !== "floating" && value.kind !== "bigint")
        return bodyFrontier("BodyAnalysis requires the completed numeric enum constant at its actual selected carrier.");
      constantOrigins.push(empty);
      continue;
    }
    if (constant.value.kind === "observation") {
      const stopped = accountFailure(account) ?? chargeWork(account, 1);
      if (stopped !== null) return stopped;
      const at = constant.value.at;
      if (at.body !== execution.instance.body) return bodyFrontier("An observation operand must belong to the exact executing body.");
      const ready = deps.observationOf(account, execution.instance, at);
      if (ready.kind !== "complete") return ready;
      if (ready.value === null || ready.value.node !== at.node || ready.value.result !== constant.type || kind !== "primitive")
        return bodyFrontier("BodyAnalysis requires the completed scalar observation at its actual qualified use.");
      constantOrigins.push(empty);
      continue;
    }
    const isAbsence = constant.value.kind === "literal" && constant.value.value.kind === "absence";
    if (constant.value.kind !== "literal" || kind === null || kind === "reference" || kind === "array-reference"
      || (isAbsence ? kind !== "absence" && kind !== "primitive-optional" && kind !== "reference-optional"
        : kind === "absence" || kind === "reference-optional")) {
      const stop = accountFailure(account);
      return stop ?? bodyFrontier("BodyAnalysis requires the actual selected non-scalar constant relation.");
    }
    hasAbsence ||= isAbsence;
    constantOrigins.push(isAbsence ? absent : empty);
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
      resourceLimitDiagnostic({ owner: "analyses/body", limit: `analysis.${limit}`, maximum: deps.limits[limit],
        site: { kind: "source", origin: tir.root.origin }, unit: { request: deps.unit, position: { kind: "result" } } })] });
  const formalCount = signature.parameters.length + (signature.receiver === null ? 0 : 1);
  const directStatics = statics?.cells ?? [];
  const copyCaptureCount = capturedEntries.length - locationCaptureCount;
  const baseRecords = 2 + formalCount + locationCaptureCount * 3 + copyCaptureCount * 2 + valueEntries.length * 2 + valueCaptureCount;
  let contextReferences = formalCount + locationCaptureCount * 5 + copyCaptureCount * 3 + valueEntries.length * 3 + valueCaptureCount;
  let lifetimeRecords = 0;
  const bound = bounded("maximumRelationalRecordsPerBody", baseRecords + directStatics.length + (hasAbsence ? 1 : 0))
    ?? bounded("maximumRelationalReferencesPerBody", contextReferences)
    ?? bounded("maximumConditionAlternatives", 1)
    ?? (valueEntries.length + valueCaptureCount === 0 ? null : bounded("maximumOriginAlternatives", 1));
  if (bound !== null) return bound;
  const source = preparedSource ?? sourceOccurrences(tir, account);
  if (source.kind !== "complete") return source;
  const imported: { value: StaticCallInventory | null } = { value: null };
  const calledSlot: StaticCalleeCells = (summary, sourceCell) => imported.value?.slotOf(summary, sourceCell);
  let hasOpenCalls = false;
  const solved = solveAssigned(deps, input, staticSlots, summary => {
    hasOpenCalls ||= summary.arena.boundaries.length !== 0;
    if (summary.arena.cells.length === 0) return null;
    if (imported.value === null) {
      const inventory = staticCallInventory(deps, input, directStatics, locationCaptureCount,
        (additional, absence) => bounded("maximumRelationalRecordsPerBody",
          baseRecords + directStatics.length + additional + (hasAbsence || absence ? 1 : 0)));
      if (inventory.kind !== "complete") return inventory;
      imported.value = inventory.value;
    }
    return imported.value.include(summary);
  }, calledSlot);
  if (solved.kind !== "complete") return solved;
  let buildFacts = solved.value.error === null;
  const calledStatics = imported.value?.additional ?? [];
  const staticCount = directStatics.length + calledStatics.length;
  const staticCallees = imported.value?.cellOf ?? null;
  hasAbsence ||= (imported.value?.absent.size ?? 0) !== 0;
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
  const staticCaptureCount = staticCount === 0 ? 0 : locationCaptureCount;
  const initialWork = chargeWork(account, localOrigins.length + staticCount + staticCaptureCount)
    ?? chargeResultEntries(account, localOrigins.length + staticCount * 5 + staticCaptureCount);
  if (initialWork !== null) return initialWork;
  const boundarySlots: number[] = [];
  for (let position = 0; position < staticCount; position += 1) {
    localOrigins.push(staticAbsence?.has(localOrigins.length) === true || imported.value?.absent.has(localOrigins.length) === true ? absent : empty);
  }
  const staticCell = (slot: number): number | null => slot < mir.locals.length ? null : locationCaptureCount + slot - mir.locals.length;
  const initialOrigins = [...localOrigins];
  for (const local of valueEntries) {
    const entry = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
    if (entry !== null) return entry;
    const producer = local.role.kind === "receiver" ? 0 : local.role.index + (signature.receiver === null ? 0 : 1);
    if (producers[producer]?.kind !== local.role.kind)
      return bodyFrontier("An incoming value retains its actual signature formal or receiver producer.");
    const bound = boundProducerId(boundProducers.length);
    if (local.copied) {
      const copy = retainCopiedEntry(bound);
      if (copy !== null) return copy;
    }
    const origins = originsId(originRows.length);
    boundProducers.push({ id: bound, producer: producerId(producer), bindings: mir.bindings.bindings, context: valueContextId(0) });
    originRows.push({ id: origins, kind: "complete", producers: [bound], includesAbsence: false });
    localOrigins[local.local] = origins;
    if (local.role.kind === "parameter") parameterOrigins[local.role.index] = origins;
    else receiverOrigins = origins;
  }
  const entryCaptures: CaptureBinding[] = [];
  for (let index = 0; index < capturedEntries.length; index += 1) {
    const captureWork = chargeWork(account, 1) ?? chargeResultEntries(account, 10);
    if (captureWork !== null) return captureWork;
    const { local, mode } = requirePresent(capturedEntries[index], { owner: "analyses/body", query: null, origin: null,
      message: "A verified selected capture inventory retains every actual incoming MIR local." });
    const producer = producerId(producers.length);
    const location = boundProducerId(boundProducers.length);
    if (mode === "captured-location") {
      const cell = cells.length;
      cells.push({ id: cell, role: { kind: "capture", index }, occurrence: { kind: "entry", execution, local }, lifetimes: [] });
      cellLocals.push(local);
      boundarySlots.push(local);
      const binding = { index, location, cell };
      capturedLocals.set(local, binding);
      entryCaptures.push(binding);
    }
    producers.push({ id: producer, path: null, kind: "capture", index });
    boundProducers.push({ id: location, producer, bindings: tir.lexicalBindings, context: valueContextId(0) });
    const holdingRead = objectValues === null ? null : chargeWork(account, 1);
    if (holdingRead !== null) return holdingRead;
    const kind = objectValues?.has(local) === true ? "reference" : valueKind(deps, requirePresent(mir.locals[local], { owner: "analyses/body", query: null, origin: null,
      message: "An actual capture retains its selected local storage." }).storage);
    const classified = accountFailure(account);
    if (classified !== null) return classified;
    if (kind === "reference" || kind === "array-reference" || kind === "reference-optional" || kind === "primitive-optional") {
      const growth = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
      if (growth !== null) return growth;
      if (kind === "primitive-optional") {
        const copy = retainCopiedEntry(location);
        if (copy !== null) return copy;
      }
      const origins = originsId(originRows.length);
      originRows.push({ id: origins, kind: "complete", producers: [location], includesAbsence: false });
      localOrigins[local] = origins;
    }
    if (mode === "captured-value")
      entryCaptures.push({ index, origins: requirePresent(localOrigins[local], { owner: "analyses/body", query: null,
        origin: null, message: "A copied entry captures its actual value Origins." }) });
  }
  if (staticCount !== 0) {
    for (const rows of [directStatics, calledStatics]) for (const cell of rows) {
      const local = mir.locals.length + cell.id - locationCaptureCount;
      boundarySlots.push(local);
      cellLocals.push(local);
      cells.push(cell);
    }
  }
  const entryBoundCount = boundProducers.length;
  const argumentWork = chargeWork(account, signature.parameters.length) ?? chargeResultEntries(account, hasAbsence ? 1 : 0);
  if (argumentWork !== null) return argumentWork;
  const contexts: ValueContext[] = [{ id: valueContextId(0), receiver: signature.receiver === null ? null
    : requirePresent(receiverOrigins, { owner: "analyses/body", query: null, origin: null, message: "A selected receiver retains its actual scalar origins." }),
    arguments: signature.parameters.map((_, index) => index >= execution.provided ? { kind: "omitted" }
      : { kind: "provided", origins: requirePresent(parameterOrigins[index],
        { owner: "analyses/body", query: null, origin: null, message: "Every supplied formal retains its entry origins." }) }), captures: entryCaptures }];
  if (projections !== null && referenceFormals === null)
    return bodyFrontier("A held projection needs its independently verified reference formal.");
  const projectionSetup = referenceFormals === null ? null : chargeResultEntries(account, 3);
  if (projectionSetup !== null) return projectionSetup;
  const projectionEffects = referenceFormals === null ? null : createProjectionEffects(deps, referenceFormals, (records, references): DataflowStop | null => {
    const stop = bounded("maximumRelationalRecordsPerBody", records, arena.cells.length + arena.boundProducers.length
      + arena.producers.length + arena.contexts.length + arena.origins.length + arena.boundaries.length + arena.projections.length + lifetimeRecords)
      ?? bounded("maximumRelationalReferencesPerBody", references, contextReferences);
    if (stop !== null) return stop;
    contextReferences += references;
    return null;
  });
  const boundaries: OpenBoundary[] = [];
  const arena = { cells, projections: projectionEffects?.projections ?? [], producers, boundProducers, boundaries, contexts,
    origins: originRows } satisfies BodyRoundValue["facts"]["arena"];
  const boundarySetup = hasOpenCalls ? chargeResultEntries(account, 3) : null;
  if (boundarySetup !== null) return boundarySetup;
  const transport = hasOpenCalls ? openCallTransport(deps, input, producers, boundaries, (records, references) => {
    const stop = bounded("maximumRelationalRecordsPerBody", records, arena.cells.length + arena.boundProducers.length
      + arena.producers.length + arena.contexts.length + arena.origins.length + arena.boundaries.length + arena.projections.length + lifetimeRecords)
      ?? bounded("maximumRelationalReferencesPerBody", references, contextReferences);
    if (stop !== null) return stop;
    contextReferences += references;
    return null;
  }) : null;
  const values = valueOrigins(deps, originRows);
  if (values.kind !== "complete") return values;
  const callLocations = prepareCallCaptures(deps, input, arena, source.value, solved.value.entry, solved.value.reachable,
    capturedLocals, cellLocals, bounded, contextReferences);
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
  const escapes: ValueEscape[] = [];
  const retention: ValueRetention[] = [];
  let returnAssigned: ReadonlySet<number> | null = null;
  let unwindAssigned: ReadonlySet<number> | null = null;
  const writeInventory = chargeResultEntries(account, 3);
  if (writeInventory !== null) return writeInventory;
  const cellWrites = new Map<number, OriginsId>();
  const normalContents = new Map<number, OriginsId>();
  const unwindContents = new Map<number, OriginsId>();
  let resultOrigins = empty;
  let thrownOrigins = empty;
  const admitUnion = (count: number, retain: boolean): DataflowStop | null => {
    const alternatives = bounded("maximumOriginAlternatives", count);
    if (alternatives !== null || !retain) return alternatives;
    const bound = bounded("maximumRelationalRecordsPerBody", 1, arena.cells.length + arena.boundProducers.length
        + arena.producers.length + arena.contexts.length + arena.origins.length + arena.boundaries.length + arena.projections.length + lifetimeRecords)
      ?? bounded("maximumRelationalReferencesPerBody", count, contextReferences);
    if (bound !== null) return bound;
    contextReferences += count;
    return null;
  };
  const initializationPoints: InitializationPoint[] = [];
  const initializationState: InitializationRow[] = [];
  const need = (cell: number, point: MirPoint, witness: Extract<InitializationPoint, { readonly kind: "need" }>["witness"],
    assigned: ReadonlySet<number>): DataflowStop | null => recordInitializationPoint(deps, initializationPoints, initializationState,
      { kind: "need", at: { kind: "body", execution, point, edge: null }, cell, witness }, boundarySlots, assigned);
  let currentOrigins: readonly OriginsId[] = localOrigins;
  const originsOf = (operand: MirOperand): OriginsId => operandOrigins(input, constantOrigins, currentOrigins, operand, staticSlots, projections);
  const flow = buildFacts && (hasReference || hasOptional || cellLocals.length !== 0) ? solveValueOrigins(deps, input, arena, values.value, constantOrigins, initialOrigins,
    localOrigins, solved.value.reachable, admitUnion, callLocations.value.calls, cellLocals, solved.value.calls,
    staticSlots, staticCallees, projections, objectValues, transport) : null;
  if (flow !== null && flow.kind !== "complete") return flow;
  let causalNeed: CallError | null = null;
  let directFailures: Map<NodeId, UninitializedRead> | null = null;
  let placedFailure: PlacedInitializationRead | null = null;
  const absorbTaint = (assigned: AssignedState, local: number): boolean => {
    if (assigned.taint === null) return false;
    const cause = unwrittenCause(assigned, local);
    if (cause === null) return false;
    causalNeed ??= cause;
    return true;
  };
  const read = (operand: MirOperand, site: TirSyntaxOccurrence | NodeId | undefined, assigned: AssignedState, point: MirPoint): DataflowStop | null => {
    const admission = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (admission !== null) return admission;
    if (operand.kind === "constant") return null;
    let witness = requirePresent(typeof site === "number" ? source.value.get(site) : site, {
      owner: "analyses/body", query: null, origin: null, message: "A verified read retains its actual source occurrence." });
    for (;;) {
      if (witness.kind === "ParenthesizedExpression" || witness.kind === "AsExpression" || witness.kind === "TypeAssertionExpression"
        || witness.kind === "SatisfiesExpression" || witness.kind === "NonNullExpression") {
        const step = chargeWork(account, 1);
        if (step !== null) return step;
        witness = witness.expression;
      } else if (witness.kind === "BinaryExpression" && witness.tsonic.role === "sequence") {
        const step = chargeWork(account, 1);
        if (step !== null) return step;
        witness = witness.right;
      } else break;
    }
    const node = witness.id;
    const projection = projections?.places.get(operand.place);
    const local = projection?.holder ?? rootSlot(mir, operand.place, staticSlots);
    const present = assigned.written.has(local);
    const unavailable = !present && !absorbTaint(assigned, local);
    const cell = unavailable ? capturedLocals.get(local)?.cell ?? staticCell(local) : null;
    if (unavailable && cell === null) {
      const retained = recordUninitializedRead(deps, mir, directFailures, node, local, witness.origin);
      if (retained.kind !== "complete") return retained;
      directFailures = retained.value;
      buildFacts = false;
      return null;
    }
    if (buildFacts) {
      if (projection !== undefined && present) {
        const effect = requirePresent(projectionEffects ?? undefined, { owner: "analyses/body", query: null, origin: witness.origin,
          message: "A held projection read requires its actual read effect inventory." });
        const held = requirePresent(arena.origins[requirePresent(currentOrigins[local], { owner: "analyses/body", query: null,
          origin: witness.origin, message: "A held receiver requires its actual local Origins." })], { owner: "analyses/body",
          query: null, origin: witness.origin, message: "A held reference requires its actual Origins row." });
        const read = effect.observe("read", projection, held, boundProducers, producers);
        if (read !== null) return read;
      }
      let occurrences = initialized.get(node);
      if (occurrences === undefined) {
        const growth = chargeResultEntries(account, 1);
        if (growth !== null) return growth;
        occurrences = new Map<PlaceId, InitializationFact>();
        initialized.set(node, occurrences);
      }
      const previous = occurrences.get(operand.place);
      if (previous === undefined) {
        const growth = chargeResultEntries(account, 3);
        if (growth !== null) return growth;
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
        if (typeof joined !== "number") return joined;
        const growth = chargeResultEntries(account, 2);
        if (growth !== null) return growth;
        reads[index] = { ...previousRead, origins: joined };
        occurrences.set(operand.place, { node, place: operand.place, assigned: previous.assigned && present });
      }
    }
    return cell !== null && buildFacts ? need(cell, point, { read: { kind: "body", value: { body: tir.body, node } }, via: [] },
      assigned.written) : null;
  };
  const sourceArguments = (operation: MirTerminator): readonly TirArgument[] => {
    const syntax = source.value.get(operation.tir.node);
    const phase = syntax?.kind === "CallExpression" || syntax?.kind === "NewExpression" ? syntax.tsonic : null;
    const application = phase != null && "application" in phase ? phase.application : null;
    if (application?.kind !== "decided")
      return bodyFrontier("A selected direct call retains its actual source application and argument occurrences.");
    return application.decision.arguments;
  };
  const readCallArgument = (operation: Extract<MirTerminator, { readonly kind: "call" }>, argument: TirArgument | undefined,
    index: number, assigned: AssignedState, point: MirPoint, retain?: (operand: MirOperand) => void): DataflowStop | null => {
    const selected = scalarArgument(deps, operation, index);
    if (selected.kind !== "complete") return selected;
    if (argument?.kind !== "provided" || argument.parameter !== index)
      return bodyFrontier("A selected fixed argument retains its actual provided occurrence and formal declaration.");
    const stopped = read(selected.value, argument.expression, assigned, point);
    if (stopped === null && buildFacts) retain?.(selected.value);
    return stopped;
  };
  const callNeeds = (summary: Summary, rows: readonly BoundInitializationRow[], operation: Extract<MirTerminator, { readonly kind: "call" }>,
    bindings: readonly { readonly kind: "cell"; readonly index: number }[], assigned: AssignedState, point: MirPoint): DataflowStop | null => {
    let witnessRows: Map<InitializationPoint, number> | null = null;
    for (const row of rows) {
      const work = chargeWork(account, 1);
      if (work !== null) return work;
      if (row.point.kind !== "need" || row.condition.alternatives.length !== 0) continue;
      const read = chargeWork(account, 3);
      if (read !== null) return read;
      const sourceCell = requirePresent(summary.initialization.cells[row.point.cell], { owner: "analyses/body", query: null, origin: operation.origin,
        message: "An applied need retains its actual source cell selector." });
      const binding = requirePresent(bindings[sourceCell], { owner: "analyses/body", query: null, origin: operation.origin,
        message: "An applied need retains its actual caller cell binding." });
      const local = requirePresent(cellLocals[binding.index], { owner: "analyses/body", query: null, origin: operation.origin,
        message: "An applied need retains its actual executing local." });
      if (assigned.written.has(local) || absorbTaint(assigned, local)) continue;
      const incoming = capturedLocals.get(local)?.cell ?? staticCell(local);
      if (incoming === null) {
        if (placedFailure === null) {
          const retained = chargeResultEntries(account, 1);
          if (retained !== null) return retained;
          placedFailure = { node: operation.tir, point, origin: operation.origin };
        }
        buildFacts = false;
        return null;
      }
      if (!buildFacts) continue;
      if (witnessRows === null) {
        const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
        if (setup !== null) return setup;
        witnessRows = new Map();
        for (let index = 0; index < summary.initialization.rows.length; index += 1) {
          const work = chargeWork(account, 1);
          if (work !== null) return work;
          const source = requirePresent(summary.initialization.rows[index], { owner: "analyses/body", query: null, origin: operation.origin,
            message: "A verified summary retains every actual initialization row." });
          const sourcePoint = requirePresent(summary.initialization.points[source.point], { owner: "analyses/body", query: null, origin: operation.origin,
            message: "A verified initialization row retains its actual point." });
          if (source.cell !== null || sourcePoint.kind !== "need") continue;
          const growth = chargeResultEntries(account, 1);
          if (growth !== null) return growth;
          witnessRows.set(sourcePoint, index);
        }
      }
      const source = requirePresent(witnessRows.get(row.point), { owner: "analyses/body", query: null, origin: operation.origin,
        message: "An applied need retains its actual source summary read-point row." });
      const witness = row.point.witness;
      const state = sourceNeedAssigned(deps, summary, source, bindings, cellLocals, assigned.written);
      if (state.kind !== "complete") return state;
      const growth = chargeWork(account, witness.via.length + 1) ?? chargeResultEntries(account, witness.via.length + 2);
      if (growth !== null) return growth;
      const propagated = need(incoming, point, { read: witness.read, via: [{ key: summary.key, row: source }, ...witness.via] }, state.value);
      if (propagated !== null) return propagated;
    }
    return null;
  };
  const boundCallNeeds = (summary: Summary, operation: Extract<MirTerminator, { readonly kind: "call" }>,
    bindings: readonly { readonly kind: "cell"; readonly index: number }[], assigned: AssignedState, point: MirPoint): DataflowStop | null => {
    const bound = bindCallInitialization(deps, operation, summary, arena, bindings);
    return bound.kind === "complete" ? callNeeds(summary, bound.value, operation, bindings, assigned, point) : bound;
  };
  for (const block of mir.blocks) {
    const blockWork = chargeWork(account, 1);
    if (blockWork !== null) return blockWork;
    if (solved.value.reachable[block.id] !== true) continue;
    if (solved.value.entry[block.id] === null) continue;
    if (buildFacts) currentOrigins = flow === null ? localOrigins : requirePresent(flow.value.entry[block.id]?.origins, {
      owner: "analyses/body", query: null, origin: block.origin, message: "A reached block retains its actual solved value-flow entry." });
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
        const result = read(operand, operandSite(source.value.get(statement.tir.node), index, false), assigned,
          { block: block.id, statement: position });
        if (result !== null) return result;
        index += 1;
      }
      const projection = statement.kind === "assign" ? projections?.places.get(statement.place) : undefined;
      if (buildFacts && statement.kind === "assign" && projection !== undefined) {
        if (statement.value.kind !== "use" || projectionEffects === null)
          return bodyFrontier("A held projection write requires its actual assigned value and projection inventory.");
        const receiver = currentOrigins[projection.holder];
        const held = receiver === undefined ? undefined : arena.origins[receiver];
        if (held === undefined) return bodyFrontier("A held projection write requires its actual receiver Origins.");
        const observed = projectionEffects.observe("write", projection, held, boundProducers, producers);
        if (observed !== null) return observed;
        const growth = chargeResultEntries(account, 3);
        if (growth !== null) return growth;
        const selection = source.value.get(statement.tir.node);
        const stored = selection?.kind === "BinaryExpression" && selection.tsonic.role === "assignment"
          && selection.tsonic.calculation === null ? { body: statement.tir.body, node: selection.right.id } : statement.tir;
        writes.push({ point: { block: block.id, statement: position }, node: statement.tir.node,
          operation: "mutation", destination: projection.kind === "field" ? "member" : "element", targets: held.producers, owner: null,
          values: [{ source: stored, origins: originsOf(statement.value.operand), reason: null }], boundaries: [] });
      } else if (buildFacts && statement.kind === "assign") {
        const value = statement.value;
        if (value.kind !== "use" && (value.kind !== "unary" && value.kind !== "binary" && value.kind !== "convert"
          || value.operation.decision.kind !== "selected" || value.operation.decision.execution.kind !== "pure"))
          return bodyFrontier("BodyAnalysis requires the actual selected operation effect and Origins transport.");
        const place: Extract<MirOperand, { readonly kind: "place" }> = { kind: "place", place: statement.place };
        const local = rootSlot(mir, statement.place, staticSlots);
        const capture = capturedLocals.get(local);
        const transferred = transferValue(deps, input, constantOrigins, initialOrigins, currentOrigins, statement, staticSlots, projections);
        if (transferred.kind !== "complete") return transferred;
        currentOrigins = transferred.value;
        const storeWork = chargeResultEntries(account, 3);
        if (storeWork !== null) return storeWork;
        const storedOrigins = originsOf(place);
        if (capture !== undefined) {
          const retained = recordCaptureWrite(deps, input, readLocal(mir, place), capture.cell, storedOrigins, cellWrites, statement,
            values.value, admitUnion);
          if (retained !== null) return retained;
          const target = chargeResultEntries(account, 1);
          if (target !== null) return target;
          const escaped = retainValue(deps, execution, statement, { block: block.id, statement: position },
            { kind: "capture", index: capture.index, path: null }, storedOrigins, arena, escapes, retention, copiedEntries);
          if (escaped !== null) return escaped;
        }
        const staticTarget = staticCell(local);
        if (staticTarget !== null) {
          const retained = recordCellWrite(deps, staticTarget, storedOrigins, cellWrites, values.value, admitUnion);
          if (retained !== null) return retained;
        }
        writes.push({ point: { block: block.id, statement: position }, node: statement.tir.node,
          operation: capture !== undefined || assigned.written.has(local) ? "mutation" : "initialization", destination: "binding",
          targets: capture === undefined ? [] : [capture.location], owner: null,
          values: [{ source: statement.tir, origins: storedOrigins, reason: null }], boundaries: [] });
      }
      if (buildFacts && statement.kind !== "assign" && (hasReference || hasOptional)) {
        const transferred = transferValue(deps, input, constantOrigins, initialOrigins, currentOrigins, statement, staticSlots, projections);
        if (transferred.kind !== "complete") return transferred;
        currentOrigins = transferred.value;
      }
      const next = transferAssigned(mir, statement, assigned, account, staticSlots);
      const transferStop = accountFailure(account);
      if (transferStop !== null) return transferStop;
      assigned = next;
      position += 1;
    }
    const terminatorWork = chargeWork(account, 3) ?? chargeResultEntries(account, 2);
    if (terminatorWork !== null) return terminatorWork;
    const terminator = block.terminator;
    if (terminator.kind === "call") {
      const callRead = chargeWork(account, 1);
      if (callRead !== null) return callRead;
      const selected = selectedCallAt(solved.value.calls, block.id);
      const point = { block: block.id, statement: null };
      const least = isLeastCall(selected);
      const summary = least || isCallError(selected) ? null : selected;
      if ((!buildFacts || least) && terminator.callee.kind === "direct") {
        const provided = least ? selected.execution.provided : isCallError(selected) ? selected.provided : selected.key.execution.provided;
        const source = sourceArguments(terminator);
        for (let index = 0; index < provided; index += 1) {
          const stopped = readCallArgument(terminator, source[index], index, assigned, point);
          if (stopped !== null) return stopped;
        }
      }
      const callCaptures = terminator.callee.kind !== "body" ? [] : requirePresent(callLocations.value.calls.get(block.id), {
        owner: "analyses/body", query: null, origin: terminator.origin, message: "An executing body call retains its actual prepared capture inventory." });
      for (let position = 0; position < callCaptures.length; position += 1) {
        const captureRead = chargeWork(account, 1);
        if (captureRead !== null) return captureRead;
        const capture = requirePresent(callCaptures[position], { owner: "analyses/body", query: null, origin: terminator.origin,
          message: "A body call retains its actual capture transport." });
        if (capture.kind === "value") {
          const stopped = read({ kind: "place", place: capture.place }, terminator.tir.node, assigned, point);
          if (stopped !== null) return stopped;
        }
      }
      if (summary === null) continue;
      const cellBindings: { readonly kind: "cell"; readonly index: number }[] = [];
      for (const cell of summary.arena.cells) {
        const work = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
        if (work !== null) return work;
        const actual = callCellIndex(summary, cell.id, callCaptures, staticCallees);
        if (actual === undefined) return bodyFrontier("A selected callee cell requires its actual static, capture or created-cell binding.");
        cellBindings.push({ kind: "cell", index: actual });
      }
      if (!buildFacts) {
        const unmet = boundCallNeeds(summary, terminator, cellBindings, assigned, point);
        if (unmet !== null) return unmet;
        continue;
      }
      const provided = summary.key.execution.provided;
      const bound = bounded("maximumRelationalRecordsPerBody", arena.cells.length + arena.boundProducers.length
        + arena.producers.length + arena.contexts.length + arena.origins.length + arena.boundaries.length + lifetimeRecords + 1)
        ?? bounded("maximumRelationalReferencesPerBody", provided, contextReferences);
      if (bound !== null) return bound;
      contextReferences += provided;
      const growth = chargeWork(account, 1) ?? chargeResultEntries(account, 6);
      if (growth !== null) return growth;
      const arguments_: ValueArgument[] = [];
      const transports: ArgumentTransport[] = [];
      const entryBindings: ValueEntryBinding[] = [];
      for (const bound of summary.arena.boundProducers) {
        const work = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
        if (work !== null) return work;
        const producer = summary.arena.producers[bound.producer];
        const capture = producer?.kind === "capture" && producer.path === null && terminator.callee.kind === "body"
          ? callCaptures[producer.index] : undefined;
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
        for (const producer of summary.arena.producers) {
          const formalWork = chargeWork(account, 1);
          if (formalWork !== null) return formalWork;
          if (producer.kind !== "parameter") continue;
          const row = chargeResultEntries(account, 1);
          if (row !== null) return row;
          formals.set(producer.index, producer.id);
        }
        const actual = sourceArguments(terminator);
        const signatureRead = chargeWork(account, 1);
        if (signatureRead !== null) return signatureRead;
        const signature = deps.signatureOf(terminator.callee.resolution.decision.completion.signature);
        const signatureStop = accountFailure(account);
        if (signatureStop !== null) return signatureStop;
        for (let index = 0; index < signature.parameters.length; index += 1) {
          const argumentWork = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
          if (argumentWork !== null) return argumentWork;
          const sourceArgument = actual[index];
          const parameter = requirePresent(signature.parameters[index], { owner: "analyses/body", query: null, origin: terminator.origin,
            message: "An actual fixed call retains every selected signature parameter." });
          const formal: ArgumentTransport["formal"] = { owner: { kind: "summary", key: summary.key },
            producer: requirePresent(formals.get(index), { owner: "analyses/body", query: null, origin: terminator.origin,
              message: "A selected scalar call retains its actual callee formal producer." }) };
          if (index >= provided) {
            if (sourceArgument?.kind !== "omitted" || sourceArgument.parameter !== index)
              return bodyFrontier("An omitted formal retains its exact selected omitted disposition.");
            arguments_.push({ kind: "omitted" });
            transports.push({ kind: "omitted", parameter: parameter.declaration, parameterIndex: index, formal });
            continue;
          }
          const readResult = readCallArgument(terminator, sourceArgument, index, assigned, point, argument => {
            const origins = originsOf(argument);
            arguments_.push({ kind: "provided", origins });
            transports.push({ kind: "provided", authoredIndex: index, parameter: parameter.declaration, parameterIndex: index,
              repeated: false, passing: "by-value", actual: origins, formal, projection: null });
          });
          if (readResult !== null) return readResult;
        }
      }
      if (!buildFacts) {
        const unmet = boundCallNeeds(summary, terminator, cellBindings, assigned, point);
        if (unmet !== null) return unmet;
        continue;
      }
      const context = valueContextId(contexts.length);
      const environment = callCaptureBindings(deps, terminator, callCaptures, originsOf);
      if (environment.kind !== "complete") return environment;
      contexts.push({ id: context, receiver: null, arguments: arguments_, captures: environment.value });
      const applied = applyScalarCall(deps, input, terminator, point, summary, arena, context, entryBindings, cellBindings,
        (access, parameter) => projectionEffects === null ? bodyFrontier("An applied field access has no verified caller reference producer.")
          : projectionEffects.call(access, parameter, summary, arena));
      if (applied.kind !== "complete") return applied;
      const boundary = transport?.forCall(terminator, summary) ?? noCallBoundary;
      if (typeof boundary !== "function") return boundary;
      const unmet = callNeeds(summary, applied.value.initialization, terminator, cellBindings, assigned, point);
      if (unmet !== null) return unmet;
      if (!buildFacts) continue;
      const captureRetention = (summary.arena.boundaries.length === 0 ? null : transport?.retainEffects(applied.value, arena, boundary))
        ?? retainCallCaptures(deps, input, terminator, point, applied.value, capturedLocals,
          arena, escapes, retention, copiedEntries, boundary);
      if (captureRetention !== null) return captureRetention;
      let callThrown = empty;
      if (summary.unwinds) {
        const value = appliedOrigins(deps, values.value, applied.value.thrown, admitUnion, boundary);
        if (typeof value !== "number") return value;
        callThrown = value;
      }
      if (summary.unwinds && terminator.unwind.kind === "escape") {
        const joined = joinOrigins(deps, values.value, thrownOrigins, callThrown, admitUnion);
        if (typeof joined !== "number") return joined;
        thrownOrigins = joined;
        const exited = callExitAssigned(deps, mir, terminator, summary, assigned.written, "unwind", calledSlot);
        if (exited.kind !== "complete") return exited;
        const initialized = cellMustAtExit(deps, boundarySlots, exited.value, unwindAssigned);
        if (initialized.kind !== "complete") return initialized;
        unwindAssigned = initialized.value;
        if (flow !== null && cellLocals.length !== 0) {
          const contents = applyExitContents(deps, terminator, applied.value, cellLocals, "unwind", flow.value.exit[block.id], values.value, admitUnion, null, boundary);
          if (contents.kind !== "complete") return contents;
          const collected = collectExitContents(deps, contents.value.origins, localOrigins, contents.value.contents,
            cellLocals, unwindContents, values.value, admitUnion);
          if (collected !== null) return collected;
        }
        const retained = retainValue(deps, execution, terminator, point, { kind: "throw" }, callThrown, arena, escapes, retention, copiedEntries);
        if (retained !== null) return retained;
      }
      for (const write of applied.value.writes) {
        const read = chargeWork(account, 1);
        if (read !== null) return read;
        const target = write.target.targets[0];
        const value = appliedOrigins(deps, values.value, write.value, admitUnion, boundary);
        if (typeof value !== "number") return value;
        const previous = cellWrites.get(target.cell);
        const joined = previous === undefined ? value : joinOrigins(deps, values.value, previous, value, admitUnion);
        if (typeof joined !== "number") return joined;
        const growth = chargeResultEntries(account, previous === undefined ? 1 : 0);
        if (growth !== null) return growth;
        cellWrites.set(target.cell, joined);
      }
      let callResult = empty;
      if (hasReference || hasOptional || applied.value.result.includesAbsence) {
        const result = appliedOrigins(deps, values.value, applied.value.result, admitUnion, boundary);
        if (typeof result !== "number") return result;
        callResult = result;
      }
      if (summary.returns && flow !== null) {
        const descriptor = chargeResultEntries(account, terminator.destination === null ? 0 : 1);
        if (descriptor !== null) return descriptor;
        const destination = terminator.destination === null ? null : rootSlot(mir, terminator.destination, staticSlots);
        const next = applyExitContents(deps, terminator, applied.value, cellLocals, "return", flow.value.exit[block.id], values.value,
          admitUnion, destination === null ? null : { local: destination, tracked: false }, boundary);
        if (next.kind !== "complete") return next;
        currentOrigins = next.value.origins;
      }
      if (summary.key.kind === "body") activations.push({ node: terminator.tir.node, point, activation: callInstance(terminator), context,
        caller: valueContextId(0), entry: null });
      if (terminator.callee.kind === "direct") {
        const invocationWork = chargeWork(account, 1) ?? chargeResultEntries(account, 6);
        if (invocationWork !== null) return invocationWork;
        const signature = deps.signatureOf(terminator.callee.resolution.decision.completion.signature);
        const signatureStop = accountFailure(account);
        if (signatureStop !== null) return signatureStop;
        invocations.push({ node: terminator.tir.node, point, kind: signature.kind, alternatives: [{
          resolution: terminator.callee.resolution, context, arguments: transports,
          result: callResult,
          thrown: callThrown, summary: summary.key }], boundaries: transport?.at(terminator) ?? noCallBoundaries });
      }
      if (summary.returns && terminator.destination !== null) {
        const local = rootSlot(mir, terminator.destination, staticSlots);
        const capture = capturedLocals.get(local);
        if (capture !== undefined) {
          const retained = recordCaptureWrite(deps, input, readLocal(mir, { kind: "place", place: terminator.destination }),
            capture.cell, callResult, cellWrites, terminator, values.value, admitUnion);
          if (retained !== null) return retained;
          const target = chargeResultEntries(account, 1);
          if (target !== null) return target;
          const escaped = retainValue(deps, execution, terminator, point, { kind: "capture", index: capture.index, path: null },
            callResult, arena, escapes, retention, copiedEntries);
          if (escaped !== null) return escaped;
        }
        const staticTarget = staticCell(local);
        if (staticTarget !== null) {
          const retained = recordCellWrite(deps, staticTarget, callResult, cellWrites, values.value, admitUnion);
          if (retained !== null) return retained;
        }
        const write = chargeResultEntries(account, 3);
        if (write !== null) return write;
        writes.push({ point, node: terminator.tir.node, operation: capture !== undefined || assigned.written.has(local) ? "mutation" : "initialization",
          destination: "binding", targets: capture === undefined ? [] : [capture.location], owner: null,
          values: [{ source: terminator.tir, origins: originsOf({ kind: "place", place: terminator.destination }), reason: null }], boundaries: [] });
      }
      continue;
    }
    if (terminator.kind === "check") {
      const work = chargeWork(account, 3) ?? chargeResultEntries(account, 2);
      if (work !== null) return work;
      const place = mir.places[terminator.place];
      const syntax = source.value.get(terminator.tir.node);
      if (place?.base.kind !== "checked" || place.base.projection.kind !== "index" || syntax?.kind !== "ElementAccessExpression"
        || projections?.places.has(place.id) !== true)
        return bodyFrontier("A bounds check requires its actual admitted typed receiver and index.");
      const point = { block: block.id, statement: null };
      const stopped = read({ kind: "place", place: place.base.place }, syntax.expression, assigned, point)
        ?? read(place.base.projection.operand, syntax.argumentExpression, assigned, point);
      if (stopped !== null) return stopped;
    }
    let operandIndex = 0;
    for (const operand of terminatorOperands(terminator)) {
      const result = read(operand, operandSite(source.value.get(terminator.tir.node), operandIndex, terminator.kind === "switch"), assigned,
        { block: block.id, statement: null });
      if (result !== null) return result;
      operandIndex += 1;
    }
    if (!buildFacts) continue;
    if (terminator.kind === "invoke") {
      const storeWork = chargeResultEntries(account, 3);
      if (storeWork !== null) return storeWork;
      writes.push({ point: { block: block.id, statement: null }, node: terminator.tir.node,
        operation: "initialization", destination: "binding", targets: [], owner: null,
        values: [{ source: terminator.tir, origins: empty, reason: null }], boundaries: [] });
    }
    const escapesExecution = (terminator.kind === "throw" || terminator.kind === "invoke" || terminator.kind === "check" || terminator.kind === "unwind-propagate")
      && terminator.unwind.kind === "escape";
    if (flow !== null && (terminator.kind === "return" || escapesExecution)) {
      const state = flow.value.exit[block.id];
      const origins = requirePresent(state?.origins, { owner: "analyses/body", query: null, origin: terminator.origin,
        message: "An actual finite exit retains its solved current cell values." });
      const contents = requirePresent(state?.contents, { owner: "analyses/body", query: null, origin: terminator.origin,
        message: "An actual finite exit retains its solved current cell contents." });
      const collected = collectExitContents(deps, origins, localOrigins, contents, cellLocals,
        terminator.kind === "return" ? normalContents : unwindContents, values.value, admitUnion);
      if (collected !== null) return collected;
    }
    if (terminator.kind === "return") {
      const state = cellMustAtExit(deps, boundarySlots, assigned.written, returnAssigned);
      if (state.kind !== "complete") return state;
      returnAssigned = state.value;
      if (terminator.value !== null) {
        const origins = originsOf(terminator.value);
        const joined = joinOrigins(deps, values.value, resultOrigins, origins, admitUnion);
        if (typeof joined !== "number") return joined;
        resultOrigins = joined;
        subjects.push({ node: terminator.tir.node, role: "return", path: null, origins });
        const retained = retainValue(deps, execution, terminator, { block: block.id, statement: null },
          { kind: "return" }, origins, arena, escapes, retention, copiedEntries);
        if (retained !== null) return retained;
      }
    } else if (escapesExecution) {
      const state = cellMustAtExit(deps, boundarySlots, assigned.written, unwindAssigned);
      if (state.kind !== "complete") return state;
      unwindAssigned = state.value;
      if (terminator.kind === "invoke" || terminator.kind === "check") continue;
      const origins = terminator.kind === "throw" ? originsOf(terminator.operand) : flow?.value.exit[block.id]?.completion?.carried ?? empty;
      const joined = joinOrigins(deps, values.value, thrownOrigins, origins, admitUnion);
      if (typeof joined !== "number") return joined;
      thrownOrigins = joined;
      const retained = retainValue(deps, execution, terminator, { block: block.id, statement: null },
        { kind: "throw" }, origins, arena, escapes, retention, copiedEntries);
      if (retained !== null) return retained;
    }
  }
  if (!buildFacts) return initializationError(deps, execution, directFailures, placedFailure, (causalNeed ?? solved.value.error)?.grounds ?? []);
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
  const retained = collectRetainedValues(deps, escapes, retention);
  if (retained.kind !== "complete") return retained;
  const integers: IntegerFact[] = [];
  let hasFor = false;
  for (const node of source.value.values()) {
    const nodeWork = chargeWork(account, 1);
    if (nodeWork !== null) return nodeWork;
    hasFor ||= node.kind === "ForStatement";
    if (node.tsonic !== null && "convertedType" in node.tsonic) {
      if (node.tsonic.narrowing !== null)
        return bodyFrontier("BodyAnalysis requires the actual selected guard proof/invalidation relation for this refinement.");
      const integerWork = chargeResultEntries(account, 1);
      if (integerWork !== null) return integerWork;
      integers.push({ node: node.id, range: null, nonnegative: false });
    }
  }
  const counted = hasFor ? countedLoopsOf(account, mir, execution.provided, {
    sourceOf: node => source.value.get(node), mirBody: deps.mirBody, nativeFacts: deps.nativeFacts,
  })
    : noCountedProofs;
  if (counted.kind !== "complete") return counted;
  if (counted.value.ranges.length !== 0) {
    const retained = chargeResultEntries(account, counted.value.ranges.length + 1);
    if (retained !== null) return retained;
    const byNode = new Map<NodeId, CountedLoopProofs["ranges"][number]["range"]>();
    for (const range of counted.value.ranges) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      byNode.set(range.node, range.range);
    }
    for (let position = 0; position < integers.length; position += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const row = integers[position];
      if (row === undefined) return bodyFrontier("Integer facts retain their actual dense value occurrences.");
      const range = byNode.get(row.node);
      if (range === undefined) continue;
      const updated = chargeResultEntries(account, 1);
      if (updated !== null) return updated;
      integers[position] = { node: row.node, range, nonnegative: range.minimum >= 0n };
    }
  }
  const integerRows = orderedRows(integers, (left, right) => left.node - right.node, account);
  if (integerRows.kind !== "complete") return integerRows;
  const completion = chargeWork(account, boundarySlots.length + boundProducers.length)
    ?? chargeResultEntries(account, capturedEntries.length * 6 + staticCount + 5);
  if (completion !== null) return completion;
  const returns = returnAssigned !== null;
  if (returnAssigned !== null) {
    const returned = recordInitializationPoint(deps, initializationPoints, initializationState, { kind: "return" }, boundarySlots, returnAssigned);
    if (returned !== null) return returned;
  }
  if (unwindAssigned !== null) {
    const unwound = recordInitializationPoint(deps, initializationPoints, initializationState, { kind: "unwind" }, boundarySlots, unwindAssigned);
    if (unwound !== null) return unwound;
  }
  const written = collectCellWrites(deps, cells.length, boundarySlots.length, cellWrites);
  if (written.kind !== "complete") return written;
  const unchanged = removeUnchangedContents(deps, normalContents, cellLocals, localOrigins, values.value)
    ?? removeUnchangedContents(deps, unwindContents, cellLocals, localOrigins, values.value);
  if (unchanged !== null) return unchanged;
  const normal = collectCellWrites(deps, cells.length, boundarySlots.length, normalContents);
  if (normal.kind !== "complete") return normal;
  const unwound = collectCellWrites(deps, cells.length, boundarySlots.length, unwindContents);
  if (unwound.kind !== "complete") return unwound;
  const projected = contexts.length === 1 ? null : chargeWork(account, formalCount + boundarySlots.length + entryBoundCount)
    ?? chargeResultEntries(account, formalCount + boundarySlots.length + entryBoundCount + 1);
  if (projected !== null) return projected;
  const summaryArena = contexts.length === 1 ? arena : { ...arena,
    producers: boundaries.length === 0 ? producers.slice(0, formalCount + capturedEntries.length) : producers, cells: cells.slice(0, boundarySlots.length),
    boundProducers: boundProducers.slice(0, entryBoundCount), contexts: [requirePresent(contexts[0],
      { owner: "analyses/body", query: null, origin: null, message: "A scalar boundary projection retains its actual entry context." })] };
  const summary: Summary = { key: { kind: "body", execution }, signature: tir.signature, arena: summaryArena,
    parameters: [], captures: [],
    result: resultOrigins, thrown: thrownOrigins, writes: written.value.boundary, retention: retained.value.retention, callbacks: [],
    concurrentWrites: [], contentsOnReturn: normal.value.boundary, contentsOnUnwind: unwound.value.boundary,
    returns, unwinds: unwindAssigned !== null,
    initialization: { cells: boundarySlots.map((_, index) => index), events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }],
      points: initializationPoints, rows: initializationState },
    resultCells: [], backing: [], suspends: false, bindingDependent: tir.dependence === "binding-dependent" };
  const effects: Summary["parameters"][number][] = [];
  const captureEffects: Summary["captures"][number][] = [];
  if (signature.receiver !== null) {
    const read = effectPaths("read", "receiver", 0);
    if (read.kind !== "complete") return read;
    const write = effectPaths("write", "receiver", 0);
    if (write.kind !== "complete") return write;
    effects.push({ slot: { kind: "receiver" }, reads: read.value, writes: write.value });
  }
  for (let index = 0; index < signature.parameters.length; index += 1) {
    const read = effectPaths("read", "parameter", index);
    if (read.kind !== "complete") return read;
    const write = effectPaths("write", "parameter", index);
    if (write.kind !== "complete") return write;
    effects.push({ slot: { kind: "parameter", index }, reads: read.value, writes: write.value });
  }
  for (let index = 0; index < capturedEntries.length; index += 1) {
    const read = effectPaths("read", "capture", index);
    if (read.kind !== "complete") return read;
    const write = effectPaths("write", "capture", index);
    if (write.kind !== "complete") return write;
    captureEffects.push({ index, reads: read.value, writes: write.value });
  }
  const value: BodyRoundValue = { facts: { execution, arena, liveness, initialization: { reads: initialization.value },
    refinements: { refinements: counted.value.refinements, integers: integerRows.value, countedLoops: counted.value.loops }, origins: { points: [], reads: readRows.value,
      subjects: subjectRows.value, writes, escapes: retained.value.escapes, invocations, callbacks: [], activations, frontiers: [],
      constructions: [], instanceRegions: [], exitContents: { onReturn: normal.value.body, onUnwind: unwound.value.body } },
    suspension: { suspensions: [] }, errorStorage: { errors: [] }, pointerBacking: { pointers: [] }, rawLocations: [],
    fieldBindings: [], recordBindings: [], memoryBindings: [], selectedMemoryDeclarations: [], closedArrays: [] },
    summary: { ...summary, parameters: effects, captures: captureEffects } };
  return { kind: "complete", value: { kind: "ok", value, diagnostics: [], emissions: [], positions: [{ position: { kind: "result" }, error: null }] } };

  function effectPaths(access: "read" | "write", kind: "parameter" | "receiver" | "capture", index: number): DataflowResult<EffectPaths> {
    const selected = kind === "parameter" ? projectionEffects?.paths(access, index) : undefined;
    let paths: readonly ProjectionPathId[] = [];
    if (selected !== undefined) {
      const stopped = chargeWork(account, selected.size) ?? chargeResultEntries(account, selected.size + 1);
      if (stopped !== null) return stopped;
      const ordered = orderedRows([...selected], (left, right) => left - right, account);
      if (ordered.kind !== "complete") return ordered;
      paths = ordered.value;
    }
    const opened = transport?.effectsOf(access, kind, index) ?? null;
    if (opened === null) return { kind: "complete", value: { kind: "complete", paths } };
    const reserve = chargeWork(account, opened.size * 2) ?? chargeResultEntries(account, 2 + opened.size * 2);
    if (reserve !== null) return reserve;
    const ordered = orderedRows([...opened], (left, right) => left - right, account);
    if (ordered.kind !== "complete") return ordered;
    const [first, ...rest] = ordered.value;
    if (first === undefined) return bodyFrontier("An open effect retains its actual nonempty boundary inventory.");
    return { kind: "complete", value: { kind: "open", paths, boundaries: [first, ...rest] } };
  }
}
