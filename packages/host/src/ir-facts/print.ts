import type { LibraryExportIdentity, LibraryModuleIdentity, LocalRef, NodeRef, SourceNodeRef } from "../ids/contract.js";
import type { DeclarationTarget, HirCallableEndpoint } from "../ir-hir/contract.js";
import type { AccessLocation, CheckRequirement, ApplicationDecision, CompletionEndpoint, MemberDecision, ParameterMapping } from "../ir-infer/contract.js";
import type { MemberSelection, ResolvedCallee } from "../ir-tir/contract.js";
import type {
  ArtifactBindings, BindingVector, BodyInstance, ExactRational, MemberKey, MemberOrigin, SelfBinding,
  TypeBinding, TypeParameterIdentity,
} from "../ir-types/contract.js";
import type { CallbackInput, SummaryCallback } from "../snapshot/contract.js";
import type {
  ArgumentTransport, BindingStorageFact, BodyFacts, BodyObservations, BoundActivation, BoundProducer, BoundRecordField,
  CallbackEntry, CallComponent, CallEdge, CallGraph, CaptureEffect, CaptureFact, CaptureLocation,
  ClosedArrayFact, ClosedArrayReason, ConstructionAlternative, CountedLoopFact, EffectPaths,
  ErrorInvalidationFact, ErrorInvalidationReason, ErrorStorageFact, ErrorStorageFacts, EscapeFact, EscapeTarget,
  InitializationFact, InitializationFacts, InstanceRegion, IntegerFact, IntegerRange, InvocationAlternative, InvocationFact,
  LiveSegment, LivenessFacts, LocalLiveRange, MemoryBindingInventoryEntry, MemoryField, MemoryFieldBindingFact,
  MemoryLayout, MemoryRecordBindingFact, MetadataFieldRef, MetadataKey, MetadataLayoutRef, MetadataRecord,
  MirPoint, ObservationFact, OpenBoundary, OpenBoundaryRef, OriginFacts, Origins, ParameterEffect, ParameterSlot,
  PointPlaceOrigins, PointerBackingFact, PointerBackingFacts, PointerBackingOperation, PointerBackingProducer,
  PrintCallGraph, PrintFacts, PrintMetadata, PrintSummary, Producer, ProducerRef, Projection, ProjectionPath,
  RawLocationFact, ReadOriginsFact, RefinementFact, RefinementFacts, RefinementInvalidation, RefinementReason,
  RelationalArena, RelationalOwner, RelationalSite, RetentionFact, StoreLiveness, SubjectOriginsFact, Summary,
  SummaryKey, SummaryWrite, SuspensionFact, SuspensionFacts, SuspensionValue, ValueContext, ValueFrontier,
  WriteFact, WrittenOrigins, WrittenOriginsReason,
} from "./contract.js";

type Field = readonly [string, () => void];

interface Writer {
  readonly parts: string[];
  readonly pending: (() => void)[];
}

const quoted = (text: string): string => {
  const parts: string[] = ["\""];
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit === 34) parts.push("\\\"");
    else if (unit === 92) parts.push("\\\\");
    else if (unit === 8) parts.push("\\b");
    else if (unit === 9) parts.push("\\t");
    else if (unit === 10) parts.push("\\n");
    else if (unit === 12) parts.push("\\f");
    else if (unit === 13) parts.push("\\r");
    else if (unit < 32 || unit >= 0xd800 && unit <= 0xdbff &&
      !(text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) ||
      unit >= 0xdc00 && unit <= 0xdfff &&
      !(text.charCodeAt(index - 1) >= 0xd800 && text.charCodeAt(index - 1) <= 0xdbff)) {
      parts.push("\\u", unit.toString(16).padStart(4, "0"));
    } else parts.push(String.fromCharCode(unit));
  }
  parts.push("\"");
  return parts.join("");
};

const scalar = (writer: Writer, value: string | number | bigint | boolean | null): void => {
  if (typeof value === "string") writer.parts.push(quoted(value));
  else if (typeof value === "bigint") writer.parts.push(value.toString(), "n");
  else if (typeof value === "number") {
    writer.parts.push(Object.is(value, -0) ? "-0" : value === Infinity ? "+Infinity" : String(value));
  } else writer.parts.push(String(value));
};

const identity = (writer: Writer, prefix: string, value: string | number): void => {
  writer.parts.push(prefix, ":");
  scalar(writer, value);
};

const record = (writer: Writer, label: string, fields: readonly Field[]): void => {
  writer.parts.push(label, "(");
  writer.pending.push(() => { writer.parts.push(")"); });
  for (const [index, field] of Array.from(fields.entries()).reverse()) {
    writer.pending.push(field[1]);
    writer.pending.push(() => { writer.parts.push(field[0], "="); });
    if (index !== 0) writer.pending.push(() => { writer.parts.push(", "); });
  }
};

const sequence = <Value>(writer: Writer, values: readonly Value[], write: (value: Value) => void): void => {
  writer.parts.push("[");
  writer.pending.push(() => { writer.parts.push(values.length === 0 ? "]" : "\n]"); });
  for (const [index, value] of Array.from(values.entries()).reverse()) {
    writer.pending.push(() => { write(value); });
    writer.pending.push(() => { writer.parts.push(index === 0 ? "\n  " : ",\n  "); });
  }
};

const nullable = <Value>(writer: Writer, value: Value | null, write: (value: Value) => void): void => {
  if (value === null) scalar(writer, null);
  else write(value);
};

const finish = <Value>(value: Value, write: (writer: Writer, value: Value) => void): string => {
  const writer: Writer = { parts: [], pending: [] };
  writer.pending.push(() => { write(writer, value); });
  for (;;) {
    const next = writer.pending.pop();
    if (next === undefined) break;
    next();
  }
  writer.parts.push("\n");
  return writer.parts.join("");
};

const nodeRef = (writer: Writer, value: NodeRef): void => record(writer, "NodeRef", [
  ["body", () => identity(writer, "body", value.body)], ["node", () => identity(writer, "n", value.node)],
]);
const localRef = (writer: Writer, value: LocalRef): void => record(writer, "LocalRef", [
  ["body", () => identity(writer, "body", value.body)], ["local", () => identity(writer, "l", value.local)],
]);
const sourceRef = (writer: Writer, value: SourceNodeRef): void => record(writer, value.kind, [
  ["value", () => value.kind === "body" ? nodeRef(writer, value.value) : record(writer, "ItemNodeRef", [
    ["owner", () => identity(writer, "def", value.value.owner)], ["node", () => identity(writer, "n", value.value.node)],
  ])],
]);
const parameterIdentity = (writer: Writer, value: TypeParameterIdentity): void => record(writer, "TypeParameterIdentity", [
  ["owner", () => identity(writer, "def", value.owner)], ["index", () => scalar(writer, value.index)],
]);
const typeBinding = (writer: Writer, value: TypeBinding): void => {
  const common: Field[] = [["parameter", () => parameterIdentity(writer, value.parameter)]];
  if (value.kind === "bound") common.push(["type", () => identity(writer, "t", value.type)]);
  record(writer, value.kind, common);
};
const selfBinding = (writer: Writer, value: SelfBinding): void => {
  const common: Field[] = [["owner", () => identity(writer, "def", value.owner)]];
  if (value.kind === "bound") common.push(["type", () => identity(writer, "t", value.type)]);
  record(writer, value.kind, common);
};
const bindings = (writer: Writer, value: BindingVector): void => record(writer, "BindingVector", [
  ["classBindings", () => sequence(writer, value.classBindings, item => typeBinding(writer, item))],
  ["methodBindings", () => sequence(writer, value.methodBindings, item => typeBinding(writer, item))],
  ["capturedBindings", () => sequence(writer, value.capturedBindings, item => typeBinding(writer, item))],
  ["selfBindings", () => sequence(writer, value.selfBindings, item => selfBinding(writer, item))],
]);
const artifact = (writer: Writer, value: ArtifactBindings): void => record(writer, value.kind,
  value.kind === "parametric" ? [] : [["bindings", () => bindings(writer, value.bindings)]]);
const bodyInstance = (writer: Writer, value: BodyInstance): void => record(writer, "BodyInstance", [
  ["body", () => identity(writer, "body", value.body)], ["bindings", () => artifact(writer, value.bindings)],
]);
const rational = (writer: Writer, value: ExactRational): void => record(writer, "ExactRational", [
  ["numerator", () => scalar(writer, value.numerator)], ["denominator", () => scalar(writer, value.denominator)],
  ["negativeZero", () => scalar(writer, value.negativeZero)],
]);
const memberKey = (writer: Writer, value: MemberKey): void => record(writer, value.kind, value.kind === "symbol"
  ? [["declaration", () => identity(writer, "def", value.declaration)]]
  : [["value", () => value.kind === "number" ? rational(writer, value.value) : scalar(writer, value.value)]]);
const memberOrigin = (writer: Writer, value: MemberOrigin): void => record(writer, value.kind,
  value.kind === "declared" ? [["declaration", () => identity(writer, "def", value.declaration)]]
    : value.kind === "class-prototype" ? [["owner", () => identity(writer, "def", value.owner)]]
      : [["owner", () => sourceRef(writer, value.owner)], ["key", () => memberKey(writer, value.key)]]);
const endpoint = (writer: Writer, value: HirCallableEndpoint): void => record(writer, "HirCallableEndpoint", [
  ["declaration", () => identity(writer, "def", value.declaration)], ["role", () => scalar(writer, value.role)],
  ["signature", () => identity(writer, "sig", value.signature)],
  ["body", () => nullable(writer, value.body, item => identity(writer, "body", item))],
]);

const parameterMapping = (writer: Writer, value: ParameterMapping): void => {
  const fields: Field[] = [["parameter", () => scalar(writer, value.parameter)]];
  switch (value.kind) {
    case "argument": fields.push(["argument", () => scalar(writer, value.argument)],
      ["component", () => scalar(writer, value.component)], ["passing", () => scalar(writer, value.passing)]); break;
    case "default": fields.push(["initializer", () => identity(writer, "body", value.initializer)]); break;
    case "omitted": fields.push(["type", () => identity(writer, "t", value.type)]); break;
    case "rest": fields.push(["arguments", () => sequence(writer, value.arguments, item => scalar(writer, item))],
      ["passing", () => scalar(writer, value.passing)]); break;
  }
  record(writer, value.kind, fields);
};
const completion = (writer: Writer, value: CompletionEndpoint): void => record(writer, "CompletionEndpoint", [
  ["signature", () => identity(writer, "sig", value.signature)], ["completion", () => identity(writer, "t", value.completion)],
  ["yielded", () => nullable(writer, value.yielded, item => identity(writer, "t", item))],
  ["sent", () => nullable(writer, value.sent, item => identity(writer, "t", item))],
]);
const application = (writer: Writer, value: ApplicationDecision): void => record(writer, "ApplicationDecision", [
  ["candidate", () => scalar(writer, value.candidate)], ["advertised", () => endpoint(writer, value.advertised)],
  ["api", () => endpoint(writer, value.api)], ["bindings", () => bindings(writer, value.bindings)],
  ["implementationBindings", () => bindings(writer, value.implementationBindings)],
  ["parameters", () => sequence(writer, value.parameters, item => parameterMapping(writer, item))],
  ["completion", () => completion(writer, value.completion)], ["result", () => identity(writer, "t", value.result)],
  ["activation", () => scalar(writer, value.activation)],
]);
const checkRequirement = (writer: Writer, value: CheckRequirement): void =>
  record(writer, value.kind, value.kind === "required" ? [["failure", () => scalar(writer, value.failure)]] : []);
const accessLocation = (writer: Writer, value: AccessLocation): void =>
  record(writer, value.kind, value.kind === "data"
    ? [["check", () => checkRequirement(writer, value.check)], ["receiver", () => scalar(writer, value.receiver)]] : []);
const memberDecision = (writer: Writer, value: MemberDecision): void => record(writer, "MemberDecision", [
  ["key", () => memberKey(writer, value.key)], ["origins", () => sequence(writer, value.origins, item => memberOrigin(writer, item))],
  ["selectedDeclarations", () => sequence(writer, value.selectedDeclarations, item => identity(writer, "def", item))],
  ["primary", () => nullable(writer, value.primary, item => identity(writer, "def", item))],
  ["read", () => nullable(writer, value.read, item => identity(writer, "t", item))],
  ["write", () => nullable(writer, value.write, item => identity(writer, "t", item))],
  ["getter", () => nullable(writer, value.getter, item => endpoint(writer, item))],
  ["setter", () => nullable(writer, value.setter, item => endpoint(writer, item))], ["bindings", () => bindings(writer, value.bindings)],
  ["location", () => accessLocation(writer, value.location)],
]);
const resolved = (writer: Writer, value: ResolvedCallee): void => record(writer, "ResolvedCallee", [
  ["decision", () => application(writer, value.decision)],
  ["activation", () => nullable(writer, value.activation, item => bodyInstance(writer, item))],
]);
const memberSelection = (writer: Writer, value: MemberSelection): void => record(writer, "MemberSelection", [
  ["decision", () => memberDecision(writer, value.decision)], ["getter", () => nullable(writer, value.getter, item => resolved(writer, item))],
  ["setter", () => nullable(writer, value.setter, item => resolved(writer, item))],
]);
const libraryModule = (writer: Writer, value: LibraryModuleIdentity): void => record(writer, "LibraryModuleIdentity", [
  ["providerId", () => scalar(writer, value.providerId)], ["providerVersion", () => scalar(writer, value.providerVersion)],
  ["packageName", () => scalar(writer, value.packageName)], ["moduleSpecifier", () => scalar(writer, value.moduleSpecifier)],
  ["providerModuleId", () => scalar(writer, value.providerModuleId)],
]);
const libraryExport = (writer: Writer, value: LibraryExportIdentity): void => record(writer, "LibraryExportIdentity", [
  ["module", () => libraryModule(writer, value.module)], ["exportId", () => scalar(writer, value.exportId)],
  ["memberId", () => scalar(writer, value.memberId)], ["signatureId", () => scalar(writer, value.signatureId)],
]);
const owner = (writer: Writer, value: RelationalOwner): void => record(writer, value.kind, value.kind === "body"
  ? [["instance", () => bodyInstance(writer, value.instance)]]
  : [["definition", () => identity(writer, "def", value.definition)], ["bindings", () => artifact(writer, value.bindings)]]);
const site = (writer: Writer, value: RelationalSite): void => record(writer, value.kind, value.kind === "node"
  ? [["node", () => nodeRef(writer, value.node)]]
  : [["identity", () => libraryExport(writer, value.identity)], ["site", () => scalar(writer, value.site)]]);
const producerRef = (writer: Writer, value: ProducerRef): void => record(writer, "ProducerRef", [
  ["owner", () => owner(writer, value.owner)], ["producer", () => identity(writer, "producer", value.producer)],
]);
const boundaryRef = (writer: Writer, value: OpenBoundaryRef): void => record(writer, "OpenBoundaryRef", [
  ["owner", () => owner(writer, value.owner)], ["boundary", () => identity(writer, "boundary", value.boundary)],
]);
const projection = (writer: Writer, value: Projection): void => record(writer, value.kind,
  value.kind === "field" || value.kind === "method-value" ? [["member", () => memberSelection(writer, value.member)]]
    : value.kind === "index" ? [["constant", () => scalar(writer, value.constant)]] : []);
const producer = (writer: Writer, value: Producer): void => {
  const fields: Field[] = [["id", () => identity(writer, "producer", value.id)],
    ["path", () => nullable(writer, value.path, item => identity(writer, "path", item))]];
  switch (value.kind) {
    case "allocation": fields.push(["at", () => site(writer, value.at)]); break;
    case "parameter": case "capture": fields.push(["index", () => scalar(writer, value.index)]); break;
    case "receiver": break;
    case "shared": fields.push(["definition", () => identity(writer, "def", value.definition)]); break;
    case "suspension-input": fields.push(["at", () => nodeRef(writer, value.at)], ["channel", () => scalar(writer, value.channel)]); break;
    case "call-result": {
      const callee = value.callee;
      fields.push(["at", () => nodeRef(writer, value.at)], ["callee", () => record(writer, callee.kind,
        callee.kind === "direct" ? [["definition", () => identity(writer, "def", callee.definition)]] : [])]); break;
    }
  }
  record(writer, value.kind, fields);
};
const origins = (writer: Writer, value: Origins): void => {
  const fields: Field[] = [["id", () => identity(writer, "origins", value.id)],
    ["producers", () => sequence(writer, value.producers, item => identity(writer, "bound", item))],
    ["includesAbsence", () => scalar(writer, value.includesAbsence)]];
  if (value.kind === "open") fields.push(["boundaries", () => sequence(writer, value.boundaries, item => identity(writer, "boundary", item))]);
  record(writer, value.kind, fields);
};

const projectionPath = (writer: Writer, value: ProjectionPath): void => record(writer, "ProjectionPath", [
  ["id", () => identity(writer, "path", value.id)], ["parent", () => nullable(writer, value.parent, item => identity(writer, "path", item))],
  ["projection", () => projection(writer, value.projection)],
]);
const captureLocation = (writer: Writer, value: CaptureLocation): void => record(writer, "CaptureLocation", [
  ["index", () => scalar(writer, value.index)], ["location", () => identity(writer, "bound", value.location)],
]);
const valueContext = (writer: Writer, value: ValueContext): void => record(writer, "ValueContext", [
  ["id", () => identity(writer, "context", value.id)], ["receiver", () => nullable(writer, value.receiver, item => identity(writer, "origins", item))],
  ["arguments", () => sequence(writer, value.arguments, item => identity(writer, "origins", item))], ["captures", () => sequence(writer, value.captures, item => captureLocation(writer, item))],
]);
const boundProducer = (writer: Writer, value: BoundProducer): void => record(writer, "BoundProducer", [
  ["id", () => identity(writer, "bound", value.id)], ["producer", () => identity(writer, "producer", value.producer)],
  ["bindings", () => bindings(writer, value.bindings)], ["context", () => identity(writer, "context", value.context)],
]);
const openBoundary = (writer: Writer, value: OpenBoundary): void => record(writer, value.kind, [
  ["id", () => identity(writer, "boundary", value.id)], ["at", () => site(writer, value.at)],
  ["subject", () => identity(writer, "producer", value.subject)], ["owner", () => nullable(writer, value.owner, item => identity(writer, "producer", item))],
  ["bindings", () => bindings(writer, value.bindings)], ["context", () => identity(writer, "context", value.context)],
  ["detail", () => scalar(writer, value.detail)],
]);
const arena = (writer: Writer, value: RelationalArena): void => record(writer, "RelationalArena", [
  ["projections", () => sequence(writer, value.projections, item => projectionPath(writer, item))], ["producers", () => sequence(writer, value.producers, item => producer(writer, item))],
  ["contexts", () => sequence(writer, value.contexts, item => valueContext(writer, item))], ["boundProducers", () => sequence(writer, value.boundProducers, item => boundProducer(writer, item))],
  ["origins", () => sequence(writer, value.origins, item => origins(writer, item))], ["boundaries", () => sequence(writer, value.boundaries, item => openBoundary(writer, item))],
]);
const mirPoint = (writer: Writer, value: MirPoint): void => record(writer, "MirPoint", [
  ["block", () => identity(writer, "b", value.block)], ["statement", () => scalar(writer, value.statement)],
]);
const storeLiveness = (writer: Writer, value: StoreLiveness): void => record(writer, "StoreLiveness", [
  ["node", () => identity(writer, "n", value.node)], ["point", () => mirPoint(writer, value.point)],
  ["edge", () => scalar(writer, value.edge)], ["observed", () => scalar(writer, value.observed)],
]);
const liveSegment = (writer: Writer, value: LiveSegment): void => record(writer, "LiveSegment", [
  ["block", () => identity(writer, "b", value.block)], ["first", () => scalar(writer, value.first)],
  ["last", () => scalar(writer, value.last)],
]);
const localLiveRange = (writer: Writer, value: LocalLiveRange): void => record(writer, "LocalLiveRange", [
  ["local", () => identity(writer, "l", value.local)], ["segments", () => sequence(writer, value.segments, item => liveSegment(writer, item))],
]);
const bindingStorage = (writer: Writer, value: BindingStorageFact): void => record(writer, "BindingStorageFact", [
  ["local", () => identity(writer, "l", value.local)], ["addressTaken", () => scalar(writer, value.addressTaken)],
  ["captured", () => scalar(writer, value.captured)],
]);
const captureFact = (writer: Writer, value: CaptureFact): void => record(writer, "CaptureFact", [
  ["local", () => localRef(writer, value.local)], ["reads", () => scalar(writer, value.reads)],
  ["writes", () => scalar(writer, value.writes)],
]);
const liveness = (writer: Writer, value: LivenessFacts): void => record(writer, "LivenessFacts", [
  ["stores", () => sequence(writer, value.stores, item => storeLiveness(writer, item))], ["locals", () => sequence(writer, value.locals, item => localLiveRange(writer, item))],
  ["bindings", () => sequence(writer, value.bindings, item => bindingStorage(writer, item))], ["captures", () => sequence(writer, value.captures, item => captureFact(writer, item))],
]);
const initializationFact = (writer: Writer, value: InitializationFact): void => record(writer, "InitializationFact", [
  ["node", () => identity(writer, "n", value.node)], ["place", () => identity(writer, "p", value.place)],
  ["assigned", () => scalar(writer, value.assigned)],
]);
const initialization = (writer: Writer, value: InitializationFacts): void => record(writer, "InitializationFacts", [
  ["reads", () => sequence(writer, value.reads, item => initializationFact(writer, item))],
]);
const refinementInvalidation = (writer: Writer, value: RefinementInvalidation): void => record(writer, value.kind, [
  ["at", () => nodeRef(writer, value.at)],
]);
const integerRange = (writer: Writer, value: IntegerRange): void => record(writer, "IntegerRange", [
  ["minimum", () => scalar(writer, value.minimum)], ["maximum", () => scalar(writer, value.maximum)],
]);
const integerFact = (writer: Writer, value: IntegerFact): void => record(writer, "IntegerFact", [
  ["node", () => identity(writer, "n", value.node)], ["range", () => nullable(writer, value.range, item => integerRange(writer, item))],
  ["nonnegative", () => scalar(writer, value.nonnegative)],
]);
const countedLoop = (writer: Writer, value: CountedLoopFact): void => record(writer, "CountedLoopFact", [
  ["statement", () => identity(writer, "n", value.statement)], ["counterDeclaration", () => identity(writer, "n", value.counterDeclaration)],
  ["start", () => identity(writer, "n", value.start)], ["bound", () => identity(writer, "n", value.bound)],
  ["body", () => identity(writer, "n", value.body)], ["direction", () => scalar(writer, value.direction)],
  ["comparison", () => scalar(writer, value.comparison)], ["step", () => scalar(writer, value.step)],
]);
const refinements = (writer: Writer, value: RefinementFacts): void => record(writer, "RefinementFacts", [
  ["refinements", () => sequence(writer, value.refinements, item => refinementFact(writer, item))], ["integers", () => sequence(writer, value.integers, item => integerFact(writer, item))],
  ["countedLoops", () => sequence(writer, value.countedLoops, item => countedLoop(writer, item))],
]);
const readOrigins = (writer: Writer, value: ReadOriginsFact): void => record(writer, "ReadOriginsFact", [
  ["node", () => identity(writer, "n", value.node)], ["place", () => identity(writer, "p", value.place)],
  ["origins", () => identity(writer, "origins", value.origins)],
]);
const pointOrigins = (writer: Writer, value: PointPlaceOrigins): void => record(writer, "PointPlaceOrigins", [
  ["point", () => mirPoint(writer, value.point)], ["place", () => identity(writer, "p", value.place)],
  ["origins", () => identity(writer, "origins", value.origins)],
]);
const subjectOrigins = (writer: Writer, value: SubjectOriginsFact): void => record(writer, "SubjectOriginsFact", [
  ["node", () => identity(writer, "n", value.node)], ["role", () => scalar(writer, value.role)],
  ["path", () => nullable(writer, value.path, item => identity(writer, "path", item))], ["origins", () => identity(writer, "origins", value.origins)],
]);
const writtenReason = (writer: Writer, value: WrittenOriginsReason): void => record(writer, value.kind, [
  ["detail", () => scalar(writer, value.detail)],
]);
const writtenOrigins = (writer: Writer, value: WrittenOrigins): void => record(writer, "WrittenOrigins", [
  ["source", () => nullable(writer, value.source, item => nodeRef(writer, item))], ["origins", () => identity(writer, "origins", value.origins)],
  ["reason", () => nullable(writer, value.reason, item => writtenReason(writer, item))],
]);
const writeFact = (writer: Writer, value: WriteFact): void => record(writer, "WriteFact", [
  ["node", () => identity(writer, "n", value.node)], ["operation", () => scalar(writer, value.operation)],
  ["destination", () => scalar(writer, value.destination)], ["targets", () => sequence(writer, value.targets, item => identity(writer, "bound", item))],
  ["owner", () => nullable(writer, value.owner, item => identity(writer, "bound", item))], ["values", () => sequence(writer, value.values, item => writtenOrigins(writer, item))],
  ["boundaries", () => sequence(writer, value.boundaries, item => identity(writer, "boundary", item))],
]);
const escapeFact = (writer: Writer, value: EscapeFact): void => record(writer, "EscapeFact", [
  ["node", () => identity(writer, "n", value.node)], ["producer", () => identity(writer, "producer", value.producer)],
  ["target", () => escapeTarget(writer, value.target)],
]);
const argumentTransport = (writer: Writer, value: ArgumentTransport): void => record(writer, "ArgumentTransport", [
  ["authoredIndex", () => scalar(writer, value.authoredIndex)], ["parameter", () => identity(writer, "def", value.parameter)],
  ["parameterIndex", () => scalar(writer, value.parameterIndex)],
  ["repeated", () => scalar(writer, value.repeated)], ["passing", () => scalar(writer, value.passing)],
  ["actual", () => identity(writer, "origins", value.actual)], ["formal", () => producerRef(writer, value.formal)],
  ["projection", () => nullable(writer, value.projection, item => identity(writer, "path", item))],
]);
const summaryKey = (writer: Writer, value: SummaryKey): void => record(writer, "SummaryKey", [
  ["definition", () => identity(writer, "def", value.definition)], ["bindings", () => artifact(writer, value.bindings)],
]);
const invocationAlternative = (writer: Writer, value: InvocationAlternative): void => record(writer, "InvocationAlternative", [
  ["resolution", () => resolved(writer, value.resolution)], ["context", () => identity(writer, "context", value.context)],
  ["arguments", () => sequence(writer, value.arguments, item => argumentTransport(writer, item))], ["result", () => identity(writer, "origins", value.result)],
  ["thrown", () => identity(writer, "origins", value.thrown)], ["summary", () => summaryKey(writer, value.summary)],
]);
const invocationFact = (writer: Writer, value: InvocationFact): void => record(writer, value.kind, [
  ["node", () => identity(writer, "n", value.node)], ["alternatives", () => sequence(writer, value.alternatives, item => invocationAlternative(writer, item))],
  ["boundaries", () => sequence(writer, value.boundaries, item => identity(writer, "boundary", item))],
]);
const callbackEntry = (writer: Writer, value: CallbackEntry): void => record(writer, "CallbackEntry", [
  ["node", () => identity(writer, "n", value.node)], ["argument", () => argumentTransport(writer, value.argument)],
  ["timing", () => scalar(writer, value.timing)], ["rejection", () => scalar(writer, value.rejection)],
  ["inputs", () => sequence(writer, value.inputs, item => callbackInput(writer, item))],
]);
const activation = (writer: Writer, value: BoundActivation): void => record(writer, "BoundActivation", [
  ["node", () => identity(writer, "n", value.node)], ["activation", () => bodyInstance(writer, value.activation)],
  ["context", () => identity(writer, "context", value.context)], ["caller", () => nullable(writer, value.caller, item => identity(writer, "context", item))],
  ["entry", () => nullable(writer, value.entry, item => argumentTransport(writer, item))],
]);
const frontier = (writer: Writer, value: ValueFrontier): void => record(writer, value.kind, [
  ["node", () => identity(writer, "n", value.node)], ["subject", () => identity(writer, "producer", value.subject)],
  ["context", () => identity(writer, "context", value.context)],
]);
const instanceRegion = (writer: Writer, value: InstanceRegion): void => record(writer, "InstanceRegion", [
  ["owner", () => identity(writer, "def", value.owner)], ["node", () => nodeRef(writer, value.node)],
  ["context", () => identity(writer, "context", value.context)],
]);
const construction = (writer: Writer, value: ConstructionAlternative): void => record(writer, "ConstructionAlternative", [
  ["node", () => identity(writer, "n", value.node)], ["root", () => nodeRef(writer, value.root)],
  ["allocation", () => nodeRef(writer, value.allocation)], ["implementation", () => nullable(writer, value.implementation, item => identity(writer, "def", item))],
  ["body", () => nullable(writer, value.body, item => bodyInstance(writer, item))], ["regions", () => sequence(writer, value.regions, item => instanceRegion(writer, item))],
]);
const originFacts = (writer: Writer, value: OriginFacts): void => record(writer, "OriginFacts", [
  ["points", () => sequence(writer, value.points, item => pointOrigins(writer, item))], ["reads", () => sequence(writer, value.reads, item => readOrigins(writer, item))],
  ["subjects", () => sequence(writer, value.subjects, item => subjectOrigins(writer, item))], ["writes", () => sequence(writer, value.writes, item => writeFact(writer, item))],
  ["escapes", () => sequence(writer, value.escapes, item => escapeFact(writer, item))], ["invocations", () => sequence(writer, value.invocations, item => invocationFact(writer, item))],
  ["callbacks", () => sequence(writer, value.callbacks, item => callbackEntry(writer, item))], ["activations", () => sequence(writer, value.activations, item => activation(writer, item))],
  ["frontiers", () => sequence(writer, value.frontiers, item => frontier(writer, item))], ["constructions", () => sequence(writer, value.constructions, item => construction(writer, item))],
  ["instanceRegions", () => sequence(writer, value.instanceRegions, item => instanceRegion(writer, item))],
]);
const retention = (writer: Writer, value: RetentionFact): void => record(writer, "RetentionFact", [
  ["source", () => identity(writer, "producer", value.source)], ["into", () => escapeTarget(writer, value.into)],
]);
const suspensionValue = (writer: Writer, value: SuspensionValue): void => record(writer, "SuspensionValue", [
  ["place", () => identity(writer, "p", value.place)], ["origins", () => identity(writer, "origins", value.origins)],
  ["retention", () => sequence(writer, value.retention, item => retention(writer, item))], ["continuations", () => sequence(writer, value.continuations, item => scalar(writer, item))],
]);
const suspensionFact = (writer: Writer, value: SuspensionFact): void => record(writer, value.kind, [
  ["node", () => identity(writer, "n", value.node)], ["values", () => sequence(writer, value.values, item => suspensionValue(writer, item))],
]);
const suspension = (writer: Writer, value: SuspensionFacts): void => record(writer, "SuspensionFacts", [
  ["suspensions", () => sequence(writer, value.suspensions, item => suspensionFact(writer, item))],
]);
const errorStorageFact = (writer: Writer, value: ErrorStorageFact): void => record(writer, "ErrorStorageFact", [
  ["node", () => identity(writer, "n", value.node)], ["origins", () => identity(writer, "origins", value.origins)],
  ["writes", () => sequence(writer, value.writes, item => identity(writer, "n", item))], ["retention", () => sequence(writer, value.retention, item => retention(writer, item))],
  ["invalidations", () => sequence(writer, value.invalidations, item => errorInvalidation(writer, item))],
]);
const errorStorage = (writer: Writer, value: ErrorStorageFacts): void => record(writer, "ErrorStorageFacts", [
  ["errors", () => sequence(writer, value.errors, item => errorStorageFact(writer, item))],
]);
const pointerBackingProducer = (writer: Writer, value: PointerBackingProducer): void => record(writer, "PointerBackingProducer", [
  ["producer", () => identity(writer, "bound", value.producer)], ["operation", () => pointerOperation(writer, value.operation)],
]);
const pointerBackingFact = (writer: Writer, value: PointerBackingFact): void => record(writer, "PointerBackingFact", [
  ["node", () => identity(writer, "n", value.node)], ["returned", () => scalar(writer, value.returned)],
  ["origins", () => identity(writer, "origins", value.origins)], ["producers", () => sequence(writer, value.producers, item => pointerBackingProducer(writer, item))],
]);
const pointerBacking = (writer: Writer, value: PointerBackingFacts): void => record(writer, "PointerBackingFacts", [
  ["pointers", () => sequence(writer, value.pointers, item => pointerBackingFact(writer, item))],
]);
const metadataKey = (writer: Writer, value: MetadataKey): void => record(writer, "MetadataKey", [
  ["definition", () => identity(writer, "def", value.definition)], ["bindings", () => artifact(writer, value.bindings)],
]);
const layoutRef = (writer: Writer, value: MetadataLayoutRef): void => record(writer, "MetadataLayoutRef", [
  ["metadata", () => metadataKey(writer, value.metadata)], ["layout", () => identity(writer, "layout", value.layout)],
]);
const fieldRef = (writer: Writer, value: MetadataFieldRef): void => record(writer, "MetadataFieldRef", [
  ["metadata", () => metadataKey(writer, value.metadata)], ["field", () => identity(writer, "field", value.field)],
]);
const storageSelection = (writer: Writer, value: MemoryField["member"]): void => record(writer, "MemberStorageSelection", [
  ["key", () => memberKey(writer, value.key)], ["origins", () => sequence(writer, value.origins, item => memberOrigin(writer, item))],
  ["selectedDeclarations", () => sequence(writer, value.selectedDeclarations, item => identity(writer, "def", item))],
  ["primary", () => nullable(writer, value.primary, item => identity(writer, "def", item))],
  ["bindings", () => bindings(writer, value.bindings)],
]);
const memoryField = (writer: Writer, value: MemoryField): void => record(writer, "MemoryField", [
  ["id", () => identity(writer, "field", value.id)], ["occurrence", () => sourceRef(writer, value.occurrence)],
  ["owner", () => identity(writer, "t", value.owner)], ["selector", () => sourceRef(writer, value.selector)],
  ["selection", () => sourceRef(writer, value.selection)], ["member", () => storageSelection(writer, value.member)],
  ["value", () => identity(writer, "t", value.value)], ["layout", () => identity(writer, "layout", value.layout)],
  ["byteOffset", () => scalar(writer, value.byteOffset)], ["byteAlignment", () => scalar(writer, value.byteAlignment)],
]);
const observation = (writer: Writer, value: ObservationFact): void => record(writer, "ObservationFact", [
  ["node", () => identity(writer, "n", value.node)], ["operation", () => scalar(writer, value.operation)],
  ["operand", () => nodeRef(writer, value.operand)], ["layout", () => layoutRef(writer, value.layout)],
  ["field", () => nullable(writer, value.field, item => fieldRef(writer, item))], ["result", () => identity(writer, "t", value.result)],
  ["value", () => scalar(writer, value.value)],
  ["bindings", () => bindings(writer, value.bindings)],
]);
const rawLocation = (writer: Writer, value: RawLocationFact): void => record(writer, "RawLocationFact", [
  ["node", () => identity(writer, "n", value.node)], ["operation", () => scalar(writer, value.operation)],
  ["pointee", () => identity(writer, "t", value.pointee)], ["layout", () => layoutRef(writer, value.layout)],
  ["context", () => identity(writer, "context", value.context)], ["bindings", () => bindings(writer, value.bindings)],
]);
const fieldBinding = (writer: Writer, value: MemoryFieldBindingFact): void => record(writer, "MemoryFieldBindingFact", [
  ["node", () => identity(writer, "n", value.node)], ["result", () => identity(writer, "t", value.result)],
  ["owner", () => identity(writer, "t", value.owner)], ["fieldExpression", () => nodeRef(writer, value.fieldExpression)],
  ["field", () => fieldRef(writer, value.field)], ["pointer", () => nodeRef(writer, value.pointer)],
  ["pointee", () => identity(writer, "t", value.pointee)], ["context", () => identity(writer, "context", value.context)],
  ["bindings", () => bindings(writer, value.bindings)],
]);
const boundRecordField = (writer: Writer, value: BoundRecordField): void => record(writer, "BoundRecordField", [
  ["expression", () => nodeRef(writer, value.expression)], ["binding", () => identity(writer, "n", value.binding)],
]);
const recordBinding = (writer: Writer, value: MemoryRecordBindingFact): void => record(writer, "MemoryRecordBindingFact", [
  ["node", () => identity(writer, "n", value.node)], ["result", () => identity(writer, "t", value.result)],
  ["layoutExpression", () => nodeRef(writer, value.layoutExpression)], ["layout", () => layoutRef(writer, value.layout)],
  ["context", () => identity(writer, "context", value.context)], ["bindings", () => bindings(writer, value.bindings)],
  ["fields", () => sequence(writer, value.fields, item => boundRecordField(writer, item))],
]);
const bodyFacts = (writer: Writer, value: BodyFacts): void => record(writer, "BodyFacts", [
  ["instance", () => bodyInstance(writer, value.instance)], ["arena", () => arena(writer, value.arena)],
  ["liveness", () => liveness(writer, value.liveness)], ["initialization", () => initialization(writer, value.initialization)],
  ["refinements", () => refinements(writer, value.refinements)], ["origins", () => originFacts(writer, value.origins)],
  ["suspension", () => suspension(writer, value.suspension)], ["errorStorage", () => errorStorage(writer, value.errorStorage)],
  ["pointerBacking", () => pointerBacking(writer, value.pointerBacking)],
  ["rawLocations", () => sequence(writer, value.rawLocations, item => rawLocation(writer, item))], ["fieldBindings", () => sequence(writer, value.fieldBindings, item => fieldBinding(writer, item))],
  ["recordBindings", () => sequence(writer, value.recordBindings, item => recordBinding(writer, item))], ["memoryBindings", () => sequence(writer, value.memoryBindings, item => memoryInventory(writer, item))],
  ["selectedMemoryDeclarations", () => sequence(writer, value.selectedMemoryDeclarations, item => identity(writer, "def", item))], ["closedArrays", () => sequence(writer, value.closedArrays, item => closedArray(writer, item))],
]);
const parameterEffect = (writer: Writer, value: ParameterEffect): void => record(writer, "ParameterEffect", [
  ["slot", () => parameterSlot(writer, value.slot)], ["reads", () => effectPaths(writer, value.reads)],
  ["writes", () => effectPaths(writer, value.writes)],
]);
const captureEffect = (writer: Writer, value: CaptureEffect): void => record(writer, "CaptureEffect", [
  ["index", () => scalar(writer, value.index)], ["reads", () => effectPaths(writer, value.reads)],
  ["writes", () => effectPaths(writer, value.writes)],
]);
const summaryWrite = (writer: Writer, value: SummaryWrite): void => record(writer, "SummaryWrite", [
  ["target", () => identity(writer, "producer", value.target)], ["value", () => identity(writer, "origins", value.value)],
]);
const summaryCallback = (writer: Writer, value: SummaryCallback): void => record(writer, "SummaryCallback", [
  ["parameterIndex", () => scalar(writer, value.parameterIndex)], ["timing", () => scalar(writer, value.timing)],
  ["rejection", () => scalar(writer, value.rejection)], ["inputs", () => sequence(writer, value.inputs, item => callbackInput(writer, item))],
]);
const summary = (writer: Writer, value: Summary): void => record(writer, "Summary", [
  ["key", () => summaryKey(writer, value.key)], ["signature", () => identity(writer, "sig", value.signature)],
  ["arena", () => arena(writer, value.arena)], ["parameters", () => sequence(writer, value.parameters, item => parameterEffect(writer, item))],
  ["captures", () => sequence(writer, value.captures, item => captureEffect(writer, item))], ["result", () => identity(writer, "origins", value.result)],
  ["thrown", () => identity(writer, "origins", value.thrown)], ["writes", () => sequence(writer, value.writes, item => summaryWrite(writer, item))],
  ["retention", () => sequence(writer, value.retention, item => retention(writer, item))], ["callbacks", () => sequence(writer, value.callbacks, item => summaryCallback(writer, item))],
  ["invocationOnlyParameters", () => sequence(writer, value.invocationOnlyParameters, item => scalar(writer, item))], ["suspends", () => scalar(writer, value.suspends)],
  ["bindingDependent", () => scalar(writer, value.bindingDependent)],
]);
const callComponent = (writer: Writer, value: CallComponent): void => record(writer, "CallComponent", [
  ["id", () => identity(writer, "component", value.id)], ["definitions", () => sequence(writer, value.definitions, item => identity(writer, "def", item))],
  ["dependencies", () => sequence(writer, value.dependencies, item => identity(writer, "component", item))],
]);
const callEdge = (writer: Writer, value: CallEdge): void => record(writer, value.kind, [
  ["caller", () => identity(writer, "def", value.caller)], ["at", () => nodeRef(writer, value.at)],
  ["callee", () => callCallee(writer, value)], ["bindings", () => artifact(writer, value.bindings)],
]);
const callGraph = (writer: Writer, value: CallGraph): void => record(writer, "CallGraph", [
  ["definitions", () => sequence(writer, value.definitions, item => identity(writer, "def", item))], ["edges", () => sequence(writer, value.edges, item => callEdge(writer, item))],
  ["components", () => sequence(writer, value.components, item => callComponent(writer, item))],
]);

const refinementReason = (writer: Writer, value: RefinementReason): void => record(writer, value.kind,
  value.kind === "invalidated" ? [["sites", () => sequence(writer, value.sites, item => refinementInvalidation(writer, item))]]
    : [["detail", () => scalar(writer, value.detail)]]);
const refinementFact = (writer: Writer, value: RefinementFact): void => {
  const fields: Field[] = [["node", () => identity(writer, "n", value.node)],
    ["guards", () => sequence(writer, value.guards, item => identity(writer, "n", item))]];
  if (value.kind === "unproven") fields.push(["reason", () => refinementReason(writer, value.reason)]);
  record(writer, value.kind, fields);
};
const escapeTarget = (writer: Writer, value: EscapeTarget): void => {
  const fields: Field[] = [];
  switch (value.kind) {
    case "return": case "throw": break;
    case "shared": fields.push(["definition", () => identity(writer, "def", value.definition)],
      ["path", () => nullable(writer, value.path, item => identity(writer, "path", item))]); break;
    case "parameter": case "capture": fields.push(["index", () => scalar(writer, value.index)],
      ["path", () => nullable(writer, value.path, item => identity(writer, "path", item))]); break;
    case "receiver": fields.push(["path", () => nullable(writer, value.path, item => identity(writer, "path", item))]); break;
    case "callback": case "suspension": fields.push(["at", () => site(writer, value.at)]); break;
    case "external": fields.push(["boundary", () => identity(writer, "boundary", value.boundary)]); break;
  }
  record(writer, value.kind, fields);
};
const callbackInput = (writer: Writer, value: CallbackInput): void => {
  const fields: Field[] = [["parameterIndex", () => scalar(writer, value.parameterIndex)]];
  if (value.kind === "argument-element") fields.push(["sourceParameterIndex", () => scalar(writer, value.sourceParameterIndex)]);
  record(writer, value.kind, fields);
};
const errorReason = (writer: Writer, value: ErrorInvalidationReason): void => record(writer, value.kind,
  value.kind === "incomplete-origins" || value.kind === "opaque-invocation-footprint"
    ? [["affected", () => identity(writer, "origins", value.affected)]]
    : value.kind === "open-constructor-domain" ? [["constructor", () => identity(writer, "origins", value.constructor)]] : []);
const errorInvalidation = (writer: Writer, value: ErrorInvalidationFact): void => {
  const fields: Field[] = [["at", () => nodeRef(writer, value.at)], ["owner", () => identity(writer, "origins", value.owner)]];
  if (value.kind === "invalidated") {
    fields.push(["cause", () => scalar(writer, value.cause)]);
    if (value.cause === "overlapping-write") fields.push(["affected", () => identity(writer, "origins", value.affected)]);
  } else if (value.kind === "unproven") fields.push(["reason", () => errorReason(writer, value.reason)],
    ["detail", () => scalar(writer, value.detail)]);
  record(writer, value.kind, fields);
};
const pointerOperation = (writer: Writer, value: PointerBackingOperation): void => record(writer, "PointerBackingOperation", [
  ["family", () => scalar(writer, value.family)], ["operation", () => scalar(writer, value.operation)], ["at", () => nodeRef(writer, value.at)],
]);
const memoryLayout = (writer: Writer, value: MemoryLayout): void => {
  const fields: Field[] = [["id", () => identity(writer, "layout", value.id)], ["occurrence", () => sourceRef(writer, value.occurrence)],
    ["source", () => identity(writer, "t", value.source)], ["dataLayout", () => identity(writer, "def", value.dataLayout)],
    ["byteSize", () => scalar(writer, value.byteSize)], ["byteAlignment", () => scalar(writer, value.byteAlignment)],
    ["stride", () => scalar(writer, value.stride)]];
  if (value.kind === "value") fields.push(["fields", () => sequence(writer, value.fields, item => identity(writer, "field", item))]);
  else fields.push(["length", () => scalar(writer, value.length)], ["runtimeBase", () => scalar(writer, value.runtimeBase)],
    ["element", () => identity(writer, "layout", value.element)]);
  record(writer, value.kind, fields);
};
const metadata = (writer: Writer, value: MetadataRecord): void => {
  const fields: Field[] = [["key", () => metadataKey(writer, value.key)]];
  if (value.kind === "data-layout") fields.push(["occurrence", () => sourceRef(writer, value.occurrence)],
    ["fingerprint", () => scalar(writer, value.fingerprint)], ["byteOrder", () => scalar(writer, value.byteOrder)],
    ["addressWidth", () => scalar(writer, value.addressWidth)]);
  else fields.push(["root", () => identity(writer, value.kind === "memory-layout" ? "layout" : "field", value.root)],
    ["layouts", () => sequence(writer, value.layouts, item => memoryLayout(writer, item))],
    ["fields", () => sequence(writer, value.fields, item => memoryField(writer, item))]);
  record(writer, value.kind, fields);
};
const memoryInventory = (writer: Writer, value: MemoryBindingInventoryEntry): void => {
  const fields: Field[] = [["node", () => identity(writer, "n", value.node)]];
  if (value.kind === "bound") fields.push(["record", () => identity(writer, "n", value.record)]);
  record(writer, value.kind, fields);
};
const closedReason = (writer: Writer, value: ClosedArrayReason): void => record(writer, value.kind,
  value.kind === "open-origin-domain" ? [["origins", () => identity(writer, "origins", value.origins)]]
    : [["at", () => nodeRef(writer, value.at)]]);
const declarationTarget = (writer: Writer, value: DeclarationTarget): void => record(writer, value.kind,
  value.kind === "local" ? [["local", () => localRef(writer, value.local)]] : [["definition", () => identity(writer, "def", value.definition)]]);
const closedArray = (writer: Writer, value: ClosedArrayFact): void => {
  const fields: Field[] = [["node", () => identity(writer, "n", value.node)]];
  if (value.kind === "unproven") fields.push(["reason", () => closedReason(writer, value.reason)]);
  else fields.push(["declarations", () => sequence(writer, value.declarations, item => declarationTarget(writer, item))],
    ["references", () => sequence(writer, value.references, item => nodeRef(writer, item))],
    ["literals", () => sequence(writer, value.literals, item => nodeRef(writer, item))],
    ["elements", () => sequence(writer, value.elements, item => memberSelection(writer, item))]);
  record(writer, value.kind, fields);
};
const effectPaths = (writer: Writer, value: EffectPaths): void => {
  const fields: Field[] = [["paths", () => sequence(writer, value.paths, item => identity(writer, "path", item))]];
  if (value.kind === "open") fields.push(["boundaries", () => sequence(writer, value.boundaries, item => identity(writer, "boundary", item))]);
  record(writer, value.kind, fields);
};
const parameterSlot = (writer: Writer, value: ParameterSlot): void => record(writer, value.kind,
  value.kind === "receiver" ? [] : [["index", () => scalar(writer, value.index)]]);
const callCallee = (writer: Writer, edge: CallEdge): void => {
  const value = edge.callee;
  record(writer, value.kind, value.kind === "definition" ? [["definition", () => identity(writer, "def", value.definition)]]
    : [["boundary", () => boundaryRef(writer, value.boundary)]]);
};

export const printFacts: PrintFacts = facts => finish(facts, bodyFacts);
export const printObservations = (value: BodyObservations): string => finish(value, (writer, value) => record(writer, "BodyObservations", [
  ["instance", () => bodyInstance(writer, value.instance)], ["rows", () => sequence(writer, value.rows, item => observation(writer, item))],
]));
export const printSummary: PrintSummary = value => finish(value, summary);
export const printMetadata: PrintMetadata = value => finish(value, metadata);
export const printCallGraph: PrintCallGraph = value => finish(value, callGraph);
