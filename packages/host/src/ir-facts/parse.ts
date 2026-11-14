import type { TextParseResult } from "../diag/contract.js";
import type {
  BlockId, BoundProducerId, ComponentId, DefId, LayoutId, LibraryExportIdentity, LibraryModuleIdentity,
  LocalId, LocalRef, MemoryFieldId, NodeId, NodeRef, OpenBoundaryId, OriginsId, PlaceId, ProducerId, ItemNodeRef,
  ProjectionPathId, SigId, SourceNodeRef, TyId, ValueContextId, BodyId,
} from "../ids/contract.js";
import {
  blockId, boundProducerId, decodeBodyId, decodeComponentId, decodeDefId, encodeBodyId, encodeComponentId, encodeDefId,
  layoutId, localId, memoryFieldId, nodeId, openBoundaryId, originsId, placeId, producerId, projectionPathId, sigId,
  tyId, valueContextId,
} from "../ids/index.js";
import type { DeclarationTarget, HirCallableEndpoint } from "../ir-hir/contract.js";
import type { AccessLocation, CheckRequirement, ApplicationDecision, CompletionEndpoint, MemberDecision, ParameterMapping } from "../ir-infer/contract.js";
import type { MemberSelection, ResolvedCallee } from "../ir-tir/contract.js";
import type {
  ArtifactBindings, BindingVector, BodyInstance, DeclaredExecution, Execution, SignatureRequest, ExactRational, MemberKey, MemberOrigin, SelfBinding,
  TypeBinding, TypeParameterIdentity,
} from "../ir-types/contract.js";
import type { CallbackInput, SummaryCallback } from "../snapshot/contract.js";
import type {
  ArgumentTransport, BindingStorageFact, BodyFacts, BodyObservations, BoundActivation, BoundProducer, BoundRecordField,
  CallbackEntry, CallComponent, CallEdge, CallGraph, CaptureEffect, CaptureFact, CaptureLocation,
  ClosedArrayFact, ClosedArrayReason, ConstructionAlternative, CountedLoopFact, EffectPaths,
  ErrorInvalidationFact, ErrorInvalidationReason, ErrorStorageFact, ErrorStorageFacts, EscapeFact, EscapeTarget, ExitContents,
  InitializationFact, InitializationFacts, InstanceRegion, IntegerFact, IntegerRange, InvocationAlternative, InvocationFact,
  LiveSegment, LivenessFacts, LocalLiveRange, MemoryBindingInventoryEntry, MemoryField, MemoryFieldBindingFact,
  MemoryLayout, MemoryRecordBindingFact, MetadataFieldRef, MetadataKey, MetadataLayoutRef, MetadataRecord,
  MirPoint, ObservationFact, OpenBoundary, OpenBoundaryRef, OriginFacts, Origins, ParameterEffect, ParameterSlot,
  PointPlaceOrigins, PointerBackingFact, PointerBackingFacts, PointerBackingOperation, PointerBackingProducer,
  ParseCallGraph, ParseFacts, ParseMetadata, ParseObservations, ParseSummary, Producer, ProducerRef, Projection, ProjectionPath,
  RawLocationFact, ReadOriginsFact, RefinementFact, RefinementFacts, RefinementInvalidation, RefinementReason,
  RelationalArena, RelationalOwner, RelationalSite, RetentionFact, StoreLiveness, SubjectOriginsFact, Summary,
  SummaryKey, SummaryWrite, SuspensionFact, SuspensionFacts, SuspensionValue, ValueContext, ValueFrontier,
  WriteFact, WrittenOrigins, WrittenOriginsReason,
} from "./contract.js";

type Atom = number | bigint | boolean | null;
type Token = { readonly kind: "word"; readonly text: string; readonly offset: number; readonly end: number }
  | { readonly kind: "punctuation"; readonly text: string; readonly offset: number; readonly end: number }
  | { readonly kind: "string"; readonly text: string; readonly offset: number; readonly end: number;
    readonly value: string; readonly positions: readonly number[] }
  | { readonly kind: "scalar"; readonly text: string; readonly offset: number; readonly end: number; readonly value: Atom };
interface Failure { readonly offset: number; readonly expected: readonly string[]; readonly found: string | null }
type SyntaxValue = Token
  | { readonly kind: "invalid"; readonly offset: number; readonly text: string; readonly family: "string" | "number" | "other";
    readonly prefix: string; readonly positions: readonly number[]; readonly failure: Failure }
  | { readonly kind: "end"; readonly offset: number; readonly text: null };
interface State { readonly text: string; offset: number; lookahead: SyntaxValue | null }
interface RecordReader { readonly names: Set<string> }
type Decoded<Value> = { readonly kind: "value"; readonly value: Value } | { readonly kind: "invalid"; readonly failure: Failure };
type Decode<Value> = (state: State, input: SyntaxValue) => Decoded<Value>;

const reject = (offset: number, expected: readonly string[], found: string | null): Decoded<never> =>
  ({ kind: "invalid", failure: { offset, expected, found } });
const accept = <Value>(value: Value): Decoded<Value> => ({ kind: "value", value });
const then = <Value, Output>(result: Decoded<Value>, next: (value: Value) => Decoded<Output>): Decoded<Output> =>
  result.kind === "invalid" ? result : next(result.value);
const fail = (input: SyntaxValue, expected: readonly string[]): Decoded<never> =>
  reject(input.offset, expected, input.text);
const scan = (state: State): SyntaxValue => {
  let offset = state.offset;
  while (offset < state.text.length) {
    const unit = state.text.charCodeAt(offset);
    if (unit !== 32 && unit !== 9 && unit !== 10 && unit !== 13) break;
    offset += 1;
  }
  const start = offset;
  if (offset === state.text.length) return { kind: "end", offset, text: null };
  const invalid = (at: number, expected: readonly string[], family: "string" | "number" | "other", prefix = "",
    positions: readonly number[] = []): SyntaxValue => ({
    kind: "invalid", offset: start, text: state.text.charAt(start), family, prefix, positions,
    failure: { offset: at, expected, found: at >= state.text.length ? null : state.text.charAt(at) },
  });
  const character = state.text.charAt(offset);
  const special = state.text.startsWith("NaN", offset) ? { text: "NaN", value: NaN }
    : state.text.startsWith("+Infinity", offset) ? { text: "+Infinity", value: Infinity }
      : state.text.startsWith("-Infinity", offset) ? { text: "-Infinity", value: -Infinity } : null;
  if (special !== null && !/[A-Za-z0-9_-]/.test(state.text.charAt(offset + special.text.length))) {
    return { kind: "scalar", text: special.text, offset: start, end: offset + special.text.length, value: special.value };
  }
  if ("()[]=,:".includes(character)) return { kind: "punctuation", text: character, offset, end: offset + 1 };
  if (character === '"') {
    const parts: string[] = [];
    const positions: number[] = [];
    offset += 1;
    while (offset < state.text.length) {
      const characterOffset = offset;
      const current = state.text.charCodeAt(offset);
      offset += 1;
      if (current === 34) return { kind: "string", text: state.text.slice(start, offset), offset: start, end: offset,
        value: parts.join(""), positions };
      if (current < 32) return invalid(offset - 1, ["escaped string character"], "string", parts.join(""), positions);
      if (current !== 92) { parts.push(String.fromCharCode(current)); positions.push(characterOffset); continue; }
      const escapeOffset = offset;
      const escaped = state.text.charAt(offset);
      offset += 1;
      switch (escaped) {
        case '"': parts.push('"'); break;
        case "\\": parts.push("\\"); break;
        case "/": parts.push("/"); break;
        case "b": parts.push("\b"); break;
        case "f": parts.push("\f"); break;
        case "n": parts.push("\n"); break;
        case "r": parts.push("\r"); break;
        case "t": parts.push("\t"); break;
        case "u": {
          const digits = state.text.slice(offset, offset + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(digits)) return invalid(offset, ["four hexadecimal digits"], "string", parts.join(""), positions);
          parts.push(String.fromCharCode(Number.parseInt(digits, 16))); offset += 4; break;
        }
        default: return invalid(escapeOffset, ["JSON string escape"], "string", parts.join(""), positions);
      }
      positions.push(characterOffset);
    }
    return invalid(offset, ['"'], "string", parts.join(""), positions);
  }
  const unit = state.text.charCodeAt(offset);
  if (unit === 45 || unit >= 48 && unit <= 57) {
    if (unit === 45) offset += 1;
    while (state.text.charCodeAt(offset) >= 48 && state.text.charCodeAt(offset) <= 57) offset += 1;
    if (state.text.charAt(offset) === "n") {
      offset += 1;
      const text = state.text.slice(start, offset);
      if (!/^-?(?:0|[1-9][0-9]*)n$/.test(text)) return invalid(start, ["decimal bigint"], "number");
      return { kind: "scalar", text, offset: start, end: offset, value: BigInt(text.slice(0, -1)) };
    }
    if (state.text.charAt(offset) === ".") {
      offset += 1;
      while (state.text.charCodeAt(offset) >= 48 && state.text.charCodeAt(offset) <= 57) offset += 1;
    }
    if (state.text.charAt(offset) === "e" || state.text.charAt(offset) === "E") {
      offset += 1;
      if (state.text.charAt(offset) === "+" || state.text.charAt(offset) === "-") offset += 1;
      while (state.text.charCodeAt(offset) >= 48 && state.text.charCodeAt(offset) <= 57) offset += 1;
    }
    const text = state.text.slice(start, offset);
    const value = Number(text);
    if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(text) || !Number.isFinite(value)) {
      return invalid(start, ["finite decimal number"], "number");
    }
    return { kind: "scalar", text, offset: start, end: offset, value };
  }
  if (/[A-Za-z_]/.test(character)) {
    offset += 1;
    while (offset < state.text.length && /[A-Za-z0-9_-]/.test(state.text.charAt(offset))) offset += 1;
    const text = state.text.slice(start, offset);
    if (text === "true" || text === "false" || text === "null") {
      return { kind: "scalar", text, offset: start, end: offset, value: text === "null" ? null : text === "true" };
    }
    return { kind: "word", text, offset: start, end: offset };
  }
  return invalid(start, ["IR value"], "other");
};
const peek = (state: State): SyntaxValue => {
  if (state.lookahead === null) state.lookahead = scan(state);
  return state.lookahead;
};
const advance = (state: State, token: Token): void => {
  state.offset = token.end;
  state.lookahead = null;
};
const punctuation = (state: State, text: string): Decoded<null> => {
  const token = peek(state);
  if (token.kind !== "punctuation" || token.text !== text) return fail(token, [text]);
  advance(state, token);
  return accept(null);
};
const fields = (state: State, input: SyntaxValue, label: string): Decoded<RecordReader> => {
  if (input.kind !== "word" || input.text !== label) return fail(input, [label]);
  advance(state, input);
  return then(punctuation(state, "("), () => accept({ names: new Set<string>() }));
};
const fieldNameFailure = (reader: RecordReader, token: SyntaxValue, name: string): Decoded<never> => {
  if (token.kind !== "word" && token.kind !== "string" && !(token.kind === "invalid" && token.family === "string")) {
    return fail(token, ["field name"]);
  }
  const actual = token.kind === "word" ? token.text : token.kind === "string" ? token.value : token.prefix;
  let matched = 0;
  let offset = token.kind === "word" ? token.offset : token.kind === "string" ? token.end - 1 : token.failure.offset;
  if (token.kind === "word") {
    while (matched < actual.length && matched < name.length && actual.charAt(matched) === name.charAt(matched)) matched += 1;
    offset += matched;
  } else {
    for (const position of token.positions) {
      if (matched === name.length || actual.charAt(matched) !== name.charAt(matched)) { offset = position; break; }
      matched += 1;
    }
  }
  if (token.kind === "invalid" && matched === actual.length) {
    return { kind: "invalid", failure: token.failure };
  }
  return reject(offset, token.kind !== "invalid" && reader.names.has(actual)
    ? ["unique record field"] : [name === "" ? "end of record" : name], token.text);
};
const readField = <Value>(state: State, reader: RecordReader, name: string, decode: Decode<Value>): Decoded<Value> => {
  let token = peek(state);
  if (token.kind === "end" || token.kind === "punctuation" && token.text === ")") return fail(token, [name]);
  if (reader.names.size !== 0) {
    if (token.kind !== "punctuation" || token.text !== ",") return fail(token, [",", ")"]);
    advance(state, token);
    token = peek(state);
  }
  if (token.kind !== "word" && token.kind !== "string") return fieldNameFailure(reader, token, name);
  const actual = token.kind === "word" ? token.text : token.value;
  if (actual !== name) return fieldNameFailure(reader, token, name);
  advance(state, token);
  reader.names.add(name);
  return then(punctuation(state, "="), () => decode(state, peek(state)));
};
const finishRecord = <Value>(state: State, reader: RecordReader, value: Value): Decoded<Value> => {
  let token = peek(state);
  if (token.kind === "punctuation" && token.text === ")") { advance(state, token); return accept(value); }
  if (token.kind === "punctuation" && token.text === ",") {
    advance(state, token);
    token = peek(state);
    return fieldNameFailure(reader, token, "");
  }
  if (reader.names.size === 0 && (token.kind === "word" || token.kind === "string" || token.kind === "invalid" && token.family === "string")) {
    return fieldNameFailure(reader, token, "");
  }
  return fail(token, reader.names.size === 0 || token.kind === "end" ? [")"] : [",", ")"]);
};
const scalarString: Decode<string> = (state, input) => {
  if (input.kind === "invalid" && input.family === "string") return { kind: "invalid", failure: input.failure };
  if (input.kind !== "string") return fail(input, ["string"]);
  advance(state, input); return accept(input.value);
};
const scalarNumber: Decode<number> = (state, input) => {
  if (input.kind === "invalid" && input.family === "number") return { kind: "invalid", failure: input.failure };
  if (input.kind !== "scalar" || typeof input.value !== "number") return fail(input, ["number"]);
  advance(state, input); return accept(input.value);
};
const scalarBigint: Decode<bigint> = (state, input) => {
  if (input.kind === "invalid" && input.family === "number") return { kind: "invalid", failure: input.failure };
  if (input.kind !== "scalar" || typeof input.value !== "bigint") return fail(input, ["bigint"]);
  advance(state, input); return accept(input.value);
};
const scalarBoolean: Decode<boolean> = (state, input) => {
  if (input.kind !== "scalar" || typeof input.value !== "boolean") return fail(input, ["boolean"]);
  advance(state, input); return accept(input.value);
};
const literal = <const Value extends string | number>(state: State, input: SyntaxValue, values: readonly Value[]): Decoded<Value> => {
  if (input.kind === "invalid" && (input.family === "string" && values.some(value => typeof value === "string" && value.startsWith(input.prefix)) ||
    input.family === "number" && values.some(value => typeof value === "number"))) return { kind: "invalid", failure: input.failure };
  if (input.kind === "scalar" || input.kind === "string") for (const value of values) if (value === input.value) {
    advance(state, input); return accept(value);
  }
  return fail(input, values.map(value => typeof value === "string" ? JSON.stringify(value) : String(value)));
};
const nullable = <Value>(state: State, input: SyntaxValue, decode: Decode<Value>): Decoded<Value | null> => {
  if (input.kind === "scalar" && input.value === null) { advance(state, input); return accept(null); }
  return decode(state, input);
};
const arrayTail = <Value>(state: State, decode: Decode<Value>, values: Value[]): Decoded<readonly Value[]> => {
  while (true) {
    const separator = peek(state);
    if (separator.kind === "punctuation" && separator.text === "]") {
      advance(state, separator); return accept((values));
    }
    if (separator.kind !== "punctuation" || separator.text !== ",") return fail(separator, [",", "]"]);
    advance(state, separator);
    const decoded = decode(state, peek(state));
    if (decoded.kind === "invalid") return decoded;
    values.push(decoded.value);
  }
};
const sequence = <Value>(state: State, input: SyntaxValue, decode: Decode<Value>): Decoded<readonly Value[]> => {
  if (input.kind !== "punctuation" || input.text !== "[") return fail(input, ["array"]);
  advance(state, input);
  const first = peek(state);
  if (first.kind === "punctuation" && first.text === "]") { advance(state, first); return accept(([])); }
  if (first.kind === "end") return fail(first, ["]"]);
  return then(decode(state, first), value => arrayTail(state, decode, [value]));
};
const nonempty = <Value>(state: State, input: SyntaxValue, decode: Decode<Value>): Decoded<readonly [Value, ...Value[]]> => {
  if (input.kind !== "punctuation" || input.text !== "[") return fail(input, ["nonempty array"]);
  advance(state, input);
  const first = peek(state);
  if (first.kind === "punctuation" && first.text === "]") return fail(input, ["nonempty array"]);
  return then(decode(state, first), value => then(arrayTail(state, decode, []), rest => {
    const result: readonly [Value, ...Value[]] = [value, ...rest];
    return accept((result));
  }));
};
const identityPrefix = (state: State, input: SyntaxValue, prefix: string, payload: "number" | "string"): Decoded<null> => {
  if (input.kind !== "word" || input.text !== prefix) return fail(input, [prefix + ":" + payload]);
  advance(state, input);
  return punctuation(state, ":");
};
const numeric = <Identity extends number>(state: State, input: SyntaxValue, prefix: string,
  construct: (value: number) => Identity): Decoded<Identity> =>
  then(identityPrefix(state, input, prefix, "number"), () => {
    const value = peek(state);
    if (value.kind === "invalid" && value.family === "number") return { kind: "invalid", failure: value.failure };
    if (value.kind !== "scalar" || typeof value.value !== "number") return fail(value, ["number"]);
    advance(state, value); return accept(construct(value.value));
  });
const block: Decode<BlockId> = (state, input) => numeric(state, input, "b", blockId);
const bound: Decode<BoundProducerId> = (state, input) => numeric(state, input, "bound", boundProducerId);
const layout: Decode<LayoutId> = (state, input) => numeric(state, input, "layout", layoutId);
const local: Decode<LocalId> = (state, input) => numeric(state, input, "l", localId);
const field: Decode<MemoryFieldId> = (state, input) => numeric(state, input, "field", memoryFieldId);
const node: Decode<NodeId> = (state, input) => numeric(state, input, "n", nodeId);
const boundary: Decode<OpenBoundaryId> = (state, input) => numeric(state, input, "boundary", openBoundaryId);
const originsIdentity: Decode<OriginsId> = (state, input) => numeric(state, input, "origins", originsId);
const place: Decode<PlaceId> = (state, input) => numeric(state, input, "p", placeId);
const producerIdentity: Decode<ProducerId> = (state, input) => numeric(state, input, "producer", producerId);
const path: Decode<ProjectionPathId> = (state, input) => numeric(state, input, "path", projectionPathId);
const signature: Decode<SigId> = (state, input) => numeric(state, input, "sig", sigId);
const typeIdentity: Decode<TyId> = (state, input) => numeric(state, input, "t", tyId);
const contextIdentity: Decode<ValueContextId> = (state, input) => numeric(state, input, "context", valueContextId);
const definition: Decode<DefId> = (state, input) =>
  then(identityPrefix(state, input, "def", "string"), () => then(scalarString(state, peek(state)), value => {
    const decoded = decodeDefId(value);
    return decoded.kind === "decoded" ? accept(encodeDefId(decoded.value)) : fail(input, ["canonical DefId"]);
  }));
const body: Decode<BodyId> = (state, input) =>
  then(identityPrefix(state, input, "body", "string"), () => then(scalarString(state, peek(state)), value => {
    const decoded = decodeBodyId(value);
    return decoded.kind === "decoded" ? accept(encodeBodyId(decoded.value)) : fail(input, ["canonical BodyId"]);
  }));
const component: Decode<ComponentId> = (state, input) =>
  then(identityPrefix(state, input, "component", "string"), () => then(scalarString(state, peek(state)), value => {
    const decoded = decodeComponentId(value);
    return decoded.kind === "decoded" ? accept(encodeComponentId(decoded.value)) : fail(input, ["canonical ComponentId"]);
  }));
const label = <const Name extends string>(input: SyntaxValue, names: readonly Name[]): Decoded<Name> => {
  if (input.kind === "word") for (const name of names) if (input.text === name) return accept(name);
  return fail(input, names);
};
const nodeRef: Decode<NodeRef> = (state, input) => then(fields(state, input, "NodeRef"), values =>
    then(readField(state, values, "body", body), bodyValue =>
    then(readField(state, values, "node", node), nodeValue =>
      finishRecord<NodeRef>(state, values, { body: bodyValue, node: nodeValue }))));
const localRef: Decode<LocalRef> = (state, input) => then(fields(state, input, "LocalRef"), values =>
    then(readField(state, values, "body", body), bodyValue =>
    then(readField(state, values, "local", local), localValue =>
      finishRecord<LocalRef>(state, values, { body: bodyValue, local: localValue }))));
const parameterIdentity: Decode<TypeParameterIdentity> = (state, input) => then(fields(state, input, "TypeParameterIdentity"), values =>
    then(readField(state, values, "owner", definition), ownerValue =>
    then(readField(state, values, "index", scalarNumber), indexValue =>
      finishRecord<TypeParameterIdentity>(state, values, { owner: ownerValue, index: indexValue }))));
const bindings: Decode<BindingVector> = (state, input) => then(fields(state, input, "BindingVector"), values =>
    then(readField(state, values, "classBindings", (state, input) => sequence(state, input, typeBinding)), classBindingsValue =>
    then(readField(state, values, "methodBindings", (state, input) => sequence(state, input, typeBinding)), methodBindingsValue =>
    then(readField(state, values, "capturedBindings", (state, input) => sequence(state, input, typeBinding)), capturedBindingsValue =>
    then(readField(state, values, "selfBindings", (state, input) => sequence(state, input, selfBinding)), selfBindingsValue =>
      finishRecord<BindingVector>(state, values, { classBindings: classBindingsValue, methodBindings: methodBindingsValue, capturedBindings: capturedBindingsValue, selfBindings: selfBindingsValue }))))));
const bodyInstance: Decode<BodyInstance> = (state, input) => then(fields(state, input, "BodyInstance"), values =>
    then(readField(state, values, "body", body), bodyValue =>
    then(readField(state, values, "bindings", artifact), bindingsValue =>
      finishRecord<BodyInstance>(state, values, { body: bodyValue, bindings: bindingsValue }))));
const execution: Decode<Execution> = (state, input) => then(fields(state, input, "Execution"), values =>
    then(readField(state, values, "instance", bodyInstance), instanceValue =>
    then(readField(state, values, "provided", scalarNumber), provided =>
      finishRecord<Execution>(state, values, { instance: instanceValue, provided }))));
const signatureRequest: Decode<SignatureRequest> = (state, input) => then(fields(state, input, "SignatureRequest"), values =>
    then(readField(state, values, "definition", definition), definitionValue =>
    then(readField(state, values, "endpoint", (state, input) => literal(state, input, ["advertised", "api-signature", "api-body"])), endpoint =>
    then(readField(state, values, "ordinal", scalarNumber), ordinal =>
    then(readField(state, values, "bindings", artifact), bindings =>
      finishRecord<SignatureRequest>(state, values, { definition: definitionValue, endpoint, ordinal, bindings }))))));
const declaredExecution: Decode<DeclaredExecution> = (state, input) => then(fields(state, input, "DeclaredExecution"), values =>
    then(readField(state, values, "request", signatureRequest), request =>
    then(readField(state, values, "provided", scalarNumber), provided =>
      finishRecord<DeclaredExecution>(state, values, { request, provided }))));

const rational: Decode<ExactRational> = (state, input) => then(fields(state, input, "ExactRational"), values =>
    then(readField(state, values, "numerator", scalarBigint), numeratorValue =>
    then(readField(state, values, "denominator", scalarBigint), denominatorValue =>
    then(readField(state, values, "negativeZero", scalarBoolean), negativeZeroValue =>
      finishRecord<ExactRational>(state, values, { numerator: numeratorValue, denominator: denominatorValue, negativeZero: negativeZeroValue })))));
const endpoint: Decode<HirCallableEndpoint> = (state, input) => then(fields(state, input, "HirCallableEndpoint"), values =>
    then(readField(state, values, "declaration", definition), declarationValue =>
    then(readField(state, values, "role", (state, input) => literal(state, input, ["advertised","api-signature","api-body"])), roleValue =>
    then(readField(state, values, "signature", signature), signatureValue =>
    then(readField(state, values, "body", (state, input) => nullable(state, input, body)), bodyValue =>
      finishRecord<HirCallableEndpoint>(state, values, { declaration: declarationValue, role: roleValue, signature: signatureValue, body: bodyValue }))))));
const completion: Decode<CompletionEndpoint> = (state, input) => then(fields(state, input, "CompletionEndpoint"), values =>
    then(readField(state, values, "signature", signature), signatureValue =>
    then(readField(state, values, "completion", typeIdentity), completionValue =>
    then(readField(state, values, "yielded", (state, input) => nullable(state, input, typeIdentity)), yieldedValue =>
    then(readField(state, values, "sent", (state, input) => nullable(state, input, typeIdentity)), sentValue =>
      finishRecord<CompletionEndpoint>(state, values, { signature: signatureValue, completion: completionValue, yielded: yieldedValue, sent: sentValue }))))));
const application: Decode<ApplicationDecision> = (state, input) => then(fields(state, input, "ApplicationDecision"), values =>
    then(readField(state, values, "candidate", scalarNumber), candidateValue =>
    then(readField(state, values, "advertised", endpoint), advertisedValue =>
    then(readField(state, values, "api", endpoint), apiValue =>
    then(readField(state, values, "bindings", bindings), bindingsValue =>
    then(readField(state, values, "implementationBindings", bindings), implementationBindingsValue =>
    then(readField(state, values, "parameters", (state, input) => sequence(state, input, parameterMapping)), parametersValue =>
    then(readField(state, values, "completion", completion), completionValue =>
    then(readField(state, values, "result", typeIdentity), resultValue =>
    then(readField(state, values, "activation", (state, input) => nullable(state, input, (state, input) => literal(state, input, ["at-creation","when-first-driven"]))), activationValue =>
      finishRecord<ApplicationDecision>(state, values, { candidate: candidateValue, advertised: advertisedValue, api: apiValue, bindings: bindingsValue, implementationBindings: implementationBindingsValue, parameters: parametersValue, completion: completionValue, result: resultValue, activation: activationValue })))))))))));
const checkRequirement: Decode<CheckRequirement> = (state, input) => then(label(input, ["none","required"]), kind => {
  switch (kind) {
    case "none": return then(fields(state, input, "none"), values =>
      finishRecord<CheckRequirement>(state, values, { kind: "none" }));
    case "required": return then(fields(state, input, "required"), values =>
    then(readField(state, values, "failure", (state, input) => literal(state, input, ["unwind","abort"])), failureValue =>
      finishRecord<CheckRequirement>(state, values, { kind: "required", failure: failureValue })));
  }
});
const accessLocation: Decode<AccessLocation> = (state, input) => then(label(input, ["data","accessor"]), kind => {
  switch (kind) {
    case "data": return then(fields(state, input, "data"), values =>
    then(readField(state, values, "check", checkRequirement), checkValue =>
    then(readField(state, values, "receiver", (state, input) => literal(state, input, ["in-place","by-reference"])), receiverValue =>
      finishRecord<AccessLocation>(state, values, { kind: "data", check: checkValue, receiver: receiverValue }))));
    case "accessor": return then(fields(state, input, "accessor"), values =>
      finishRecord<AccessLocation>(state, values, { kind: "accessor" }));
  }
});
const memberDecision: Decode<MemberDecision> = (state, input) => then(fields(state, input, "MemberDecision"), values =>
    then(readField(state, values, "key", memberKey), keyValue =>
    then(readField(state, values, "origins", (state, input) => sequence(state, input, memberOrigin)), originsValue =>
    then(readField(state, values, "selectedDeclarations", (state, input) => sequence(state, input, definition)), selectedDeclarationsValue =>
    then(readField(state, values, "primary", (state, input) => nullable(state, input, definition)), primaryValue =>
    then(readField(state, values, "read", (state, input) => nullable(state, input, typeIdentity)), readValue =>
    then(readField(state, values, "write", (state, input) => nullable(state, input, typeIdentity)), writeValue =>
    then(readField(state, values, "getter", (state, input) => nullable(state, input, endpoint)), getterValue =>
    then(readField(state, values, "setter", (state, input) => nullable(state, input, endpoint)), setterValue =>
    then(readField(state, values, "bindings", bindings), bindingsValue =>
    then(readField(state, values, "location", accessLocation), locationValue =>
      finishRecord<MemberDecision>(state, values, { key: keyValue, origins: originsValue, selectedDeclarations: selectedDeclarationsValue, primary: primaryValue, read: readValue, write: writeValue, getter: getterValue, setter: setterValue, bindings: bindingsValue, location: locationValue }))))))))))));
const resolved: Decode<ResolvedCallee> = (state, input) => then(fields(state, input, "ResolvedCallee"), values =>
    then(readField(state, values, "decision", application), decisionValue =>
    then(readField(state, values, "activation", (state, input) => nullable(state, input, bodyInstance)), activationValue =>
      finishRecord<ResolvedCallee>(state, values, { decision: decisionValue, activation: activationValue }))));
const memberSelection: Decode<MemberSelection> = (state, input) => then(fields(state, input, "MemberSelection"), values =>
    then(readField(state, values, "decision", memberDecision), decisionValue =>
    then(readField(state, values, "getter", (state, input) => nullable(state, input, resolved)), getterValue =>
    then(readField(state, values, "setter", (state, input) => nullable(state, input, resolved)), setterValue =>
      finishRecord<MemberSelection>(state, values, { decision: decisionValue, getter: getterValue, setter: setterValue })))));
const libraryModule: Decode<LibraryModuleIdentity> = (state, input) => then(fields(state, input, "LibraryModuleIdentity"), values =>
    then(readField(state, values, "providerId", scalarString), providerIdValue =>
    then(readField(state, values, "providerVersion", scalarString), providerVersionValue =>
    then(readField(state, values, "packageName", (state, input) => nullable(state, input, scalarString)), packageNameValue =>
    then(readField(state, values, "moduleSpecifier", scalarString), moduleSpecifierValue =>
    then(readField(state, values, "providerModuleId", scalarString), providerModuleIdValue =>
      finishRecord<LibraryModuleIdentity>(state, values, { providerId: providerIdValue, providerVersion: providerVersionValue, packageName: packageNameValue, moduleSpecifier: moduleSpecifierValue, providerModuleId: providerModuleIdValue })))))));
const libraryExport: Decode<LibraryExportIdentity> = (state, input) => then(fields(state, input, "LibraryExportIdentity"), values =>
    then(readField(state, values, "module", libraryModule), moduleValue =>
    then(readField(state, values, "exportId", scalarString), exportIdValue =>
    then(readField(state, values, "memberId", (state, input) => nullable(state, input, scalarString)), memberIdValue =>
    then(readField(state, values, "signatureId", (state, input) => nullable(state, input, scalarString)), signatureIdValue =>
      finishRecord<LibraryExportIdentity>(state, values, { module: moduleValue, exportId: exportIdValue, memberId: memberIdValue, signatureId: signatureIdValue }))))));
const producerRef: Decode<ProducerRef> = (state, input) => then(fields(state, input, "ProducerRef"), values =>
    then(readField(state, values, "owner", owner), ownerValue =>
    then(readField(state, values, "producer", producerIdentity), producerValue =>
      finishRecord<ProducerRef>(state, values, { owner: ownerValue, producer: producerValue }))));
const boundaryRef: Decode<OpenBoundaryRef> = (state, input) => then(fields(state, input, "OpenBoundaryRef"), values =>
    then(readField(state, values, "owner", owner), ownerValue =>
    then(readField(state, values, "boundary", boundary), boundaryValue =>
      finishRecord<OpenBoundaryRef>(state, values, { owner: ownerValue, boundary: boundaryValue }))));
const projectionPath: Decode<ProjectionPath> = (state, input) => then(fields(state, input, "ProjectionPath"), values =>
    then(readField(state, values, "id", path), idValue =>
    then(readField(state, values, "parent", (state, input) => nullable(state, input, path)), parentValue =>
    then(readField(state, values, "projection", projection), projectionValue =>
      finishRecord<ProjectionPath>(state, values, { id: idValue, parent: parentValue, projection: projectionValue })))));
const captureLocation: Decode<CaptureLocation> = (state, input) => then(fields(state, input, "CaptureLocation"), values =>
    then(readField(state, values, "index", scalarNumber), indexValue =>
    then(readField(state, values, "location", bound), locationValue =>
      finishRecord<CaptureLocation>(state, values, { index: indexValue, location: locationValue }))));
const valueContext: Decode<ValueContext> = (state, input) => then(fields(state, input, "ValueContext"), values =>
    then(readField(state, values, "id", contextIdentity), idValue =>
    then(readField(state, values, "receiver", (state, input) => nullable(state, input, originsIdentity)), receiverValue =>
    then(readField(state, values, "arguments", (state, input) => sequence(state, input, originsIdentity)), argumentsValue =>
    then(readField(state, values, "captures", (state, input) => sequence(state, input, captureLocation)), capturesValue =>
      finishRecord<ValueContext>(state, values, { id: idValue, receiver: receiverValue, arguments: argumentsValue, captures: capturesValue }))))));
const boundProducer: Decode<BoundProducer> = (state, input) => then(fields(state, input, "BoundProducer"), values =>
    then(readField(state, values, "id", bound), idValue =>
    then(readField(state, values, "producer", producerIdentity), producerValue =>
    then(readField(state, values, "bindings", bindings), bindingsValue =>
    then(readField(state, values, "context", contextIdentity), contextValue =>
      finishRecord<BoundProducer>(state, values, { id: idValue, producer: producerValue, bindings: bindingsValue, context: contextValue }))))));
const openBoundary: Decode<OpenBoundary> = (state, input) => then(label(input, ["external-input","external-write","opaque-write","opaque-result","unclassified-exposure","opaque-invocation","unresolved-transport"]), kind =>
  then(fields(state, input, kind), values =>
    then(readField(state, values, "id", boundary), idValue =>
    then(readField(state, values, "at", site), atValue =>
    then(readField(state, values, "subject", producerIdentity), subjectValue =>
    then(readField(state, values, "owner", (state, input) => nullable(state, input, producerIdentity)), ownerValue =>
    then(readField(state, values, "bindings", bindings), bindingsValue =>
    then(readField(state, values, "context", contextIdentity), contextValue =>
    then(readField(state, values, "detail", scalarString), detailValue =>
      finishRecord<OpenBoundary>(state, values, { kind: kind, id: idValue, at: atValue, subject: subjectValue, owner: ownerValue, bindings: bindingsValue, context: contextValue, detail: detailValue }))))))))));
const arena: Decode<RelationalArena> = (state, input) => then(fields(state, input, "RelationalArena"), values =>
    then(readField(state, values, "projections", (state, input) => sequence(state, input, projectionPath)), projectionsValue =>
    then(readField(state, values, "producers", (state, input) => sequence(state, input, producer)), producersValue =>
    then(readField(state, values, "contexts", (state, input) => sequence(state, input, valueContext)), contextsValue =>
    then(readField(state, values, "boundProducers", (state, input) => sequence(state, input, boundProducer)), boundProducersValue =>
    then(readField(state, values, "origins", (state, input) => sequence(state, input, origins)), originsValue =>
    then(readField(state, values, "boundaries", (state, input) => sequence(state, input, openBoundary)), boundariesValue =>
      finishRecord<RelationalArena>(state, values, { projections: projectionsValue, producers: producersValue, contexts: contextsValue, boundProducers: boundProducersValue, origins: originsValue, boundaries: boundariesValue }))))))));
const mirPoint: Decode<MirPoint> = (state, input) => then(fields(state, input, "MirPoint"), values =>
    then(readField(state, values, "block", block), blockValue =>
    then(readField(state, values, "statement", (state, input) => nullable(state, input, scalarNumber)), statementValue =>
      finishRecord<MirPoint>(state, values, { block: blockValue, statement: statementValue }))));
const storeLiveness: Decode<StoreLiveness> = (state, input) => then(fields(state, input, "StoreLiveness"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "point", mirPoint), pointValue =>
    then(readField(state, values, "edge", (state, input) => nullable(state, input, (state, input) => literal(state, input, ["continue", "resume", "return", "unwind"]))), edgeValue =>
    then(readField(state, values, "observed", scalarBoolean), observedValue =>
      finishRecord<StoreLiveness>(state, values, { node: nodeValue, point: pointValue, edge: edgeValue, observed: observedValue }))))));
const liveSegment: Decode<LiveSegment> = (state, input) => then(fields(state, input, "LiveSegment"), values =>
    then(readField(state, values, "block", block), blockValue =>
    then(readField(state, values, "first", scalarNumber), firstValue =>
    then(readField(state, values, "last", scalarNumber), lastValue =>
      finishRecord<LiveSegment>(state, values, { block: blockValue, first: firstValue, last: lastValue })))));
const localLiveRange: Decode<LocalLiveRange> = (state, input) => then(fields(state, input, "LocalLiveRange"), values =>
    then(readField(state, values, "local", local), localValue =>
    then(readField(state, values, "segments", (state, input) => sequence(state, input, liveSegment)), segmentsValue =>
      finishRecord<LocalLiveRange>(state, values, { local: localValue, segments: segmentsValue }))));
const bindingStorage: Decode<BindingStorageFact> = (state, input) => then(fields(state, input, "BindingStorageFact"), values =>
    then(readField(state, values, "local", local), localValue =>
    then(readField(state, values, "addressTaken", scalarBoolean), addressTakenValue =>
    then(readField(state, values, "captured", scalarBoolean), capturedValue =>
      finishRecord<BindingStorageFact>(state, values, { local: localValue, addressTaken: addressTakenValue, captured: capturedValue })))));
const captureFact: Decode<CaptureFact> = (state, input) => then(fields(state, input, "CaptureFact"), values =>
    then(readField(state, values, "local", localRef), localValue =>
    then(readField(state, values, "reads", scalarBoolean), readsValue =>
    then(readField(state, values, "writes", scalarBoolean), writesValue =>
      finishRecord<CaptureFact>(state, values, { local: localValue, reads: readsValue, writes: writesValue })))));
const liveness: Decode<LivenessFacts> = (state, input) => then(fields(state, input, "LivenessFacts"), values =>
    then(readField(state, values, "stores", (state, input) => sequence(state, input, storeLiveness)), storesValue =>
    then(readField(state, values, "locals", (state, input) => sequence(state, input, localLiveRange)), localsValue =>
    then(readField(state, values, "bindings", (state, input) => sequence(state, input, bindingStorage)), bindingsValue =>
    then(readField(state, values, "captures", (state, input) => sequence(state, input, captureFact)), capturesValue =>
      finishRecord<LivenessFacts>(state, values, { stores: storesValue, locals: localsValue, bindings: bindingsValue, captures: capturesValue }))))));
const initializationFact: Decode<InitializationFact> = (state, input) => then(fields(state, input, "InitializationFact"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "place", place), placeValue =>
    then(readField(state, values, "assigned", scalarBoolean), assignedValue =>
      finishRecord<InitializationFact>(state, values, { node: nodeValue, place: placeValue, assigned: assignedValue })))));
const initialization: Decode<InitializationFacts> = (state, input) => then(fields(state, input, "InitializationFacts"), values =>
    then(readField(state, values, "reads", (state, input) => sequence(state, input, initializationFact)), readsValue =>
      finishRecord<InitializationFacts>(state, values, { reads: readsValue })));
const refinementInvalidation: Decode<RefinementInvalidation> = (state, input) => then(label(input, ["write","call"]), kind =>
  then(fields(state, input, kind), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<RefinementInvalidation>(state, values, { kind: kind, at: atValue }))));
const integerRange: Decode<IntegerRange> = (state, input) => then(fields(state, input, "IntegerRange"), values =>
    then(readField(state, values, "minimum", scalarBigint), minimumValue =>
    then(readField(state, values, "maximum", scalarBigint), maximumValue =>
      finishRecord<IntegerRange>(state, values, { minimum: minimumValue, maximum: maximumValue }))));
const integerFact: Decode<IntegerFact> = (state, input) => then(fields(state, input, "IntegerFact"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "range", (state, input) => nullable(state, input, integerRange)), rangeValue =>
    then(readField(state, values, "nonnegative", scalarBoolean), nonnegativeValue =>
      finishRecord<IntegerFact>(state, values, { node: nodeValue, range: rangeValue, nonnegative: nonnegativeValue })))));
const countedLoop: Decode<CountedLoopFact> = (state, input) => then(fields(state, input, "CountedLoopFact"), values =>
    then(readField(state, values, "statement", node), statementValue =>
    then(readField(state, values, "counterDeclaration", node), counterDeclarationValue =>
    then(readField(state, values, "start", node), startValue =>
    then(readField(state, values, "bound", node), boundValue =>
    then(readField(state, values, "body", node), bodyValue =>
    then(readField(state, values, "direction", (state, input) => literal(state, input, ["ascending"])), directionValue =>
    then(readField(state, values, "comparison", (state, input) => literal(state, input, ["exclusive-upper-bound"])), comparisonValue =>
    then(readField(state, values, "step", (state, input) => literal(state, input, [1])), stepValue =>
      finishRecord<CountedLoopFact>(state, values, { statement: statementValue, counterDeclaration: counterDeclarationValue, start: startValue, bound: boundValue, body: bodyValue, direction: directionValue, comparison: comparisonValue, step: stepValue }))))))))));
const refinements: Decode<RefinementFacts> = (state, input) => then(fields(state, input, "RefinementFacts"), values =>
    then(readField(state, values, "refinements", (state, input) => sequence(state, input, refinementFact)), refinementsValue =>
    then(readField(state, values, "integers", (state, input) => sequence(state, input, integerFact)), integersValue =>
    then(readField(state, values, "countedLoops", (state, input) => sequence(state, input, countedLoop)), countedLoopsValue =>
      finishRecord<RefinementFacts>(state, values, { refinements: refinementsValue, integers: integersValue, countedLoops: countedLoopsValue })))));
const readOrigins: Decode<ReadOriginsFact> = (state, input) => then(fields(state, input, "ReadOriginsFact"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "place", place), placeValue =>
    then(readField(state, values, "origins", originsIdentity), originsValue =>
      finishRecord<ReadOriginsFact>(state, values, { node: nodeValue, place: placeValue, origins: originsValue })))));
const pointOrigins: Decode<PointPlaceOrigins> = (state, input) => then(fields(state, input, "PointPlaceOrigins"), values =>
    then(readField(state, values, "point", mirPoint), pointValue =>
    then(readField(state, values, "place", place), placeValue =>
    then(readField(state, values, "origins", originsIdentity), originsValue =>
      finishRecord<PointPlaceOrigins>(state, values, { point: pointValue, place: placeValue, origins: originsValue })))));
const subjectOrigins: Decode<SubjectOriginsFact> = (state, input) => then(fields(state, input, "SubjectOriginsFact"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "role", (state, input) => literal(state, input, ["input","value","member","return","receiver"])), roleValue =>
    then(readField(state, values, "path", (state, input) => nullable(state, input, path)), pathValue =>
    then(readField(state, values, "origins", originsIdentity), originsValue =>
      finishRecord<SubjectOriginsFact>(state, values, { node: nodeValue, role: roleValue, path: pathValue, origins: originsValue }))))));
const writtenReason: Decode<WrittenOriginsReason> = (state, input) => then(label(input, ["value-source-unproven"]), kind =>
  then(fields(state, input, kind), values =>
    then(readField(state, values, "detail", scalarString), detailValue =>
      finishRecord<WrittenOriginsReason>(state, values, { kind: kind, detail: detailValue }))));
const writtenOrigins: Decode<WrittenOrigins> = (state, input) => then(fields(state, input, "WrittenOrigins"), values =>
    then(readField(state, values, "source", (state, input) => nullable(state, input, nodeRef)), sourceValue =>
    then(readField(state, values, "origins", originsIdentity), originsValue =>
    then(readField(state, values, "reason", (state, input) => nullable(state, input, writtenReason)), reasonValue =>
      finishRecord<WrittenOrigins>(state, values, { source: sourceValue, origins: originsValue, reason: reasonValue })))));
const writeFact: Decode<WriteFact> = (state, input) => then(fields(state, input, "WriteFact"), values =>
    then(readField(state, values, "point", mirPoint), pointValue =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "operation", (state, input) => literal(state, input, ["initialization","mutation"])), operationValue =>
    then(readField(state, values, "destination", (state, input) => literal(state, input, ["binding","member","element","pointer"])), destinationValue =>
    then(readField(state, values, "targets", (state, input) => sequence(state, input, bound)), targetsValue =>
    then(readField(state, values, "owner", (state, input) => nullable(state, input, bound)), ownerValue =>
    then(readField(state, values, "values", (state, input) => sequence(state, input, writtenOrigins)), valuesValue =>
    then(readField(state, values, "boundaries", (state, input) => sequence(state, input, boundary)), boundariesValue =>
      finishRecord<WriteFact>(state, values, { point: pointValue, node: nodeValue, operation: operationValue, destination: destinationValue, targets: targetsValue, owner: ownerValue, values: valuesValue, boundaries: boundariesValue }))))))))));
const escapeFact: Decode<EscapeFact> = (state, input) => then(fields(state, input, "EscapeFact"), values =>
    then(readField(state, values, "point", mirPoint), pointValue =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "producer", producerIdentity), producerValue =>
    then(readField(state, values, "target", escapeTarget), targetValue =>
      finishRecord<EscapeFact>(state, values, { point: pointValue, node: nodeValue, producer: producerValue, target: targetValue }))))));
const argumentTransport: Decode<ArgumentTransport> = (state, input) => then(fields(state, input, "ArgumentTransport"), values =>
    then(readField(state, values, "authoredIndex", (state, input) => nullable(state, input, scalarNumber)), authoredIndexValue =>
    then(readField(state, values, "parameter", definition), parameterValue =>
    then(readField(state, values, "parameterIndex", scalarNumber), parameterIndexValue =>
    then(readField(state, values, "repeated", scalarBoolean), repeatedValue =>
    then(readField(state, values, "passing", (state, input) => literal(state, input, ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"])), passingValue =>
    then(readField(state, values, "actual", originsIdentity), actualValue =>
    then(readField(state, values, "formal", producerRef), formalValue =>
    then(readField(state, values, "projection", (state, input) => nullable(state, input, path)), projectionValue =>
      finishRecord<ArgumentTransport>(state, values, { authoredIndex: authoredIndexValue, parameter: parameterValue, parameterIndex: parameterIndexValue, repeated: repeatedValue, passing: passingValue, actual: actualValue, formal: formalValue, projection: projectionValue }))))))))));
const summaryKey: Decode<SummaryKey> = (state, input) => then(label(input, ["body", "declared"]), kind =>
  then(fields(state, input, kind), values => kind === "body"
    ? then(readField(state, values, "execution", execution), selected =>
      finishRecord<SummaryKey>(state, values, { kind, execution: selected }))
    : then(readField(state, values, "execution", declaredExecution), selected =>
      finishRecord<SummaryKey>(state, values, { kind, execution: selected }))));
const invocationAlternative: Decode<InvocationAlternative> = (state, input) => then(fields(state, input, "InvocationAlternative"), values =>
    then(readField(state, values, "resolution", resolved), resolutionValue =>
    then(readField(state, values, "context", contextIdentity), contextValue =>
    then(readField(state, values, "arguments", (state, input) => sequence(state, input, argumentTransport)), argumentsValue =>
    then(readField(state, values, "result", originsIdentity), resultValue =>
    then(readField(state, values, "thrown", originsIdentity), thrownValue =>
    then(readField(state, values, "summary", summaryKey), summaryValue =>
      finishRecord<InvocationAlternative>(state, values, { resolution: resolutionValue, context: contextValue, arguments: argumentsValue, result: resultValue, thrown: thrownValue, summary: summaryValue }))))))));
const invocationFact: Decode<InvocationFact> = (state, input) => then(label(input, ["call","construct","getter","setter","native-callback"]), kind =>
  then(fields(state, input, kind), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "alternatives", (state, input) => sequence(state, input, invocationAlternative)), alternativesValue =>
    then(readField(state, values, "boundaries", (state, input) => sequence(state, input, boundary)), boundariesValue =>
      finishRecord<InvocationFact>(state, values, { kind: kind, node: nodeValue, alternatives: alternativesValue, boundaries: boundariesValue }))))));
const callbackEntry: Decode<CallbackEntry> = (state, input) => then(fields(state, input, "CallbackEntry"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "argument", argumentTransport), argumentValue =>
    then(readField(state, values, "timing", (state, input) => literal(state, input, ["synchronous","deferred","unknown"])), timingValue =>
    then(readField(state, values, "rejection", (state, input) => nullable(state, input, scalarNumber)), rejectionValue =>
    then(readField(state, values, "inputs", (state, input) => sequence(state, input, callbackInput)), inputsValue =>
      finishRecord<CallbackEntry>(state, values, { node: nodeValue, argument: argumentValue, timing: timingValue, rejection: rejectionValue, inputs: inputsValue })))))));
const activation: Decode<BoundActivation> = (state, input) => then(fields(state, input, "BoundActivation"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "activation", bodyInstance), activationValue =>
    then(readField(state, values, "context", contextIdentity), contextValue =>
    then(readField(state, values, "caller", (state, input) => nullable(state, input, contextIdentity)), callerValue =>
    then(readField(state, values, "entry", (state, input) => nullable(state, input, argumentTransport)), entryValue =>
      finishRecord<BoundActivation>(state, values, { node: nodeValue, activation: activationValue, context: contextValue, caller: callerValue, entry: entryValue })))))));
const frontier: Decode<ValueFrontier> = (state, input) => then(label(input, ["boundary","origin"]), kind =>
  then(fields(state, input, kind), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "subject", producerIdentity), subjectValue =>
    then(readField(state, values, "context", contextIdentity), contextValue =>
      finishRecord<ValueFrontier>(state, values, { kind: kind, node: nodeValue, subject: subjectValue, context: contextValue }))))));
const instanceRegion: Decode<InstanceRegion> = (state, input) => then(fields(state, input, "InstanceRegion"), values =>
    then(readField(state, values, "owner", definition), ownerValue =>
    then(readField(state, values, "node", nodeRef), nodeValue =>
    then(readField(state, values, "context", contextIdentity), contextValue =>
      finishRecord<InstanceRegion>(state, values, { owner: ownerValue, node: nodeValue, context: contextValue })))));
const construction: Decode<ConstructionAlternative> = (state, input) => then(fields(state, input, "ConstructionAlternative"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "root", nodeRef), rootValue =>
    then(readField(state, values, "allocation", nodeRef), allocationValue =>
    then(readField(state, values, "implementation", (state, input) => nullable(state, input, definition)), implementationValue =>
    then(readField(state, values, "body", (state, input) => nullable(state, input, bodyInstance)), bodyValue =>
    then(readField(state, values, "regions", (state, input) => sequence(state, input, instanceRegion)), regionsValue =>
      finishRecord<ConstructionAlternative>(state, values, { node: nodeValue, root: rootValue, allocation: allocationValue, implementation: implementationValue, body: bodyValue, regions: regionsValue }))))))));
const originFacts: Decode<OriginFacts> = (state, input) => then(fields(state, input, "OriginFacts"), values =>
    then(readField(state, values, "points", (state, input) => sequence(state, input, pointOrigins)), pointsValue =>
    then(readField(state, values, "reads", (state, input) => sequence(state, input, readOrigins)), readsValue =>
    then(readField(state, values, "subjects", (state, input) => sequence(state, input, subjectOrigins)), subjectsValue =>
    then(readField(state, values, "writes", (state, input) => sequence(state, input, writeFact)), writesValue =>
    then(readField(state, values, "escapes", (state, input) => sequence(state, input, escapeFact)), escapesValue =>
    then(readField(state, values, "invocations", (state, input) => sequence(state, input, invocationFact)), invocationsValue =>
    then(readField(state, values, "callbacks", (state, input) => sequence(state, input, callbackEntry)), callbacksValue =>
    then(readField(state, values, "activations", (state, input) => sequence(state, input, activation)), activationsValue =>
    then(readField(state, values, "frontiers", (state, input) => sequence(state, input, frontier)), frontiersValue =>
    then(readField(state, values, "constructions", (state, input) => sequence(state, input, construction)), constructionsValue =>
    then(readField(state, values, "instanceRegions", (state, input) => sequence(state, input, instanceRegion)), instanceRegionsValue =>
    then(readField(state, values, "exitContents", exitContents), exitContentsValue =>
      finishRecord<OriginFacts>(state, values, { points: pointsValue, reads: readsValue, subjects: subjectsValue, writes: writesValue, escapes: escapesValue, invocations: invocationsValue, callbacks: callbacksValue, activations: activationsValue, frontiers: frontiersValue, constructions: constructionsValue, instanceRegions: instanceRegionsValue, exitContents: exitContentsValue }))))))))))))));
const exitContents: Decode<ExitContents> = (state, input) => then(fields(state, input, "ExitContents"), values =>
    then(readField(state, values, "onReturn", (state, input) => sequence(state, input, summaryWrite)), onReturnValue =>
    then(readField(state, values, "onUnwind", (state, input) => sequence(state, input, summaryWrite)), onUnwindValue =>
      finishRecord<ExitContents>(state, values, { onReturn: onReturnValue, onUnwind: onUnwindValue }))));
const retention: Decode<RetentionFact> = (state, input) => then(fields(state, input, "RetentionFact"), values =>
    then(readField(state, values, "source", producerIdentity), sourceValue =>
    then(readField(state, values, "into", escapeTarget), intoValue =>
      finishRecord<RetentionFact>(state, values, { source: sourceValue, into: intoValue }))));
const suspensionValue: Decode<SuspensionValue> = (state, input) => then(fields(state, input, "SuspensionValue"), values =>
    then(readField(state, values, "place", place), placeValue =>
    then(readField(state, values, "origins", originsIdentity), originsValue =>
    then(readField(state, values, "retention", (state, input) => sequence(state, input, retention)), retentionValue =>
    then(readField(state, values, "continuations", (state, input) => sequence(state, input, (state, input) => literal(state, input, ["resume","return","unwind"]))), continuationsValue =>
      finishRecord<SuspensionValue>(state, values, { place: placeValue, origins: originsValue, retention: retentionValue, continuations: continuationsValue }))))));
const suspensionFact: Decode<SuspensionFact> = (state, input) => then(label(input, ["await","yield","delegate"]), kind =>
  then(fields(state, input, kind), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "values", (state, input) => sequence(state, input, suspensionValue)), valuesValue =>
      finishRecord<SuspensionFact>(state, values, { kind: kind, node: nodeValue, values: valuesValue })))));
const suspension: Decode<SuspensionFacts> = (state, input) => then(fields(state, input, "SuspensionFacts"), values =>
    then(readField(state, values, "suspensions", (state, input) => sequence(state, input, suspensionFact)), suspensionsValue =>
      finishRecord<SuspensionFacts>(state, values, { suspensions: suspensionsValue })));
const errorStorageFact: Decode<ErrorStorageFact> = (state, input) => then(fields(state, input, "ErrorStorageFact"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "origins", originsIdentity), originsValue =>
    then(readField(state, values, "writes", (state, input) => sequence(state, input, node)), writesValue =>
    then(readField(state, values, "retention", (state, input) => sequence(state, input, retention)), retentionValue =>
    then(readField(state, values, "invalidations", (state, input) => sequence(state, input, errorInvalidation)), invalidationsValue =>
      finishRecord<ErrorStorageFact>(state, values, { node: nodeValue, origins: originsValue, writes: writesValue, retention: retentionValue, invalidations: invalidationsValue })))))));
const errorStorage: Decode<ErrorStorageFacts> = (state, input) => then(fields(state, input, "ErrorStorageFacts"), values =>
    then(readField(state, values, "errors", (state, input) => sequence(state, input, errorStorageFact)), errorsValue =>
      finishRecord<ErrorStorageFacts>(state, values, { errors: errorsValue })));
const pointerBackingProducer: Decode<PointerBackingProducer> = (state, input) => then(fields(state, input, "PointerBackingProducer"), values =>
    then(readField(state, values, "producer", bound), producerValue =>
    then(readField(state, values, "operation", pointerOperation), operationValue =>
      finishRecord<PointerBackingProducer>(state, values, { producer: producerValue, operation: operationValue }))));
const pointerBackingFact: Decode<PointerBackingFact> = (state, input) => then(fields(state, input, "PointerBackingFact"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "returned", scalarBoolean), returnedValue =>
    then(readField(state, values, "origins", originsIdentity), originsValue =>
    then(readField(state, values, "producers", (state, input) => sequence(state, input, pointerBackingProducer)), producersValue =>
      finishRecord<PointerBackingFact>(state, values, { node: nodeValue, returned: returnedValue, origins: originsValue, producers: producersValue }))))));
const pointerBacking: Decode<PointerBackingFacts> = (state, input) => then(fields(state, input, "PointerBackingFacts"), values =>
    then(readField(state, values, "pointers", (state, input) => sequence(state, input, pointerBackingFact)), pointersValue =>
      finishRecord<PointerBackingFacts>(state, values, { pointers: pointersValue })));
const metadataKey: Decode<MetadataKey> = (state, input) => then(fields(state, input, "MetadataKey"), values =>
    then(readField(state, values, "definition", definition), definitionValue =>
    then(readField(state, values, "bindings", artifact), bindingsValue =>
      finishRecord<MetadataKey>(state, values, { definition: definitionValue, bindings: bindingsValue }))));
const layoutRef: Decode<MetadataLayoutRef> = (state, input) => then(fields(state, input, "MetadataLayoutRef"), values =>
    then(readField(state, values, "metadata", metadataKey), metadataValue =>
    then(readField(state, values, "layout", layout), layoutValue =>
      finishRecord<MetadataLayoutRef>(state, values, { metadata: metadataValue, layout: layoutValue }))));
const fieldRef: Decode<MetadataFieldRef> = (state, input) => then(fields(state, input, "MetadataFieldRef"), values =>
    then(readField(state, values, "metadata", metadataKey), metadataValue =>
    then(readField(state, values, "field", field), fieldValue =>
      finishRecord<MetadataFieldRef>(state, values, { metadata: metadataValue, field: fieldValue }))));
const memoryField: Decode<MemoryField> = (state, input) => then(fields(state, input, "MemoryField"), values =>
    then(readField(state, values, "id", field), idValue =>
    then(readField(state, values, "occurrence", sourceRef), occurrenceValue =>
    then(readField(state, values, "owner", typeIdentity), ownerValue =>
    then(readField(state, values, "selector", sourceRef), selectorValue =>
    then(readField(state, values, "selection", sourceRef), selectionValue =>
    then(readField(state, values, "member", memberSelection), memberValue =>
    then(readField(state, values, "primary", (state, input) => nullable(state, input, definition)), primaryValue =>
    then(readField(state, values, "selectedDeclarations", (state, input) => sequence(state, input, definition)), selectedDeclarationsValue =>
    then(readField(state, values, "value", typeIdentity), valueValue =>
    then(readField(state, values, "layout", layout), layoutValue =>
    then(readField(state, values, "byteOffset", scalarBigint), byteOffsetValue =>
    then(readField(state, values, "byteAlignment", scalarBigint), byteAlignmentValue =>
      finishRecord<MemoryField>(state, values, { id: idValue, occurrence: occurrenceValue, owner: ownerValue, selector: selectorValue, selection: selectionValue, member: memberValue, primary: primaryValue, selectedDeclarations: selectedDeclarationsValue, value: valueValue, layout: layoutValue, byteOffset: byteOffsetValue, byteAlignment: byteAlignmentValue }))))))))))))));
const observation: Decode<ObservationFact> = (state, input) => then(fields(state, input, "ObservationFact"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "operation", (state, input) => literal(state, input, ["size","alignment","stride","field-offset"])), operationValue =>
    then(readField(state, values, "operand", nodeRef), operandValue =>
    then(readField(state, values, "layout", layoutRef), layoutValue =>
    then(readField(state, values, "field", (state, input) => nullable(state, input, fieldRef)), fieldValue =>
    then(readField(state, values, "result", typeIdentity), resultValue =>
    then(readField(state, values, "value", scalarBigint), valueValue =>
    then(readField(state, values, "bindings", bindings), bindingsValue =>
      finishRecord<ObservationFact>(state, values, { node: nodeValue, operation: operationValue, operand: operandValue, layout: layoutValue, field: fieldValue, result: resultValue, value: valueValue, bindings: bindingsValue }))))))))));
const bodyObservations: Decode<BodyObservations> = (state, input) => then(fields(state, input, "BodyObservations"), values =>
  then(readField(state, values, "instance", bodyInstance), instanceValue =>
    then(readField(state, values, "rows", (state, input) => sequence(state, input, observation)), rowsValue =>
      finishRecord<BodyObservations>(state, values, { instance: instanceValue, rows: rowsValue }))));
const rawLocation: Decode<RawLocationFact> = (state, input) => then(fields(state, input, "RawLocationFact"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "operation", (state, input) => literal(state, input, ["to-raw","reinterpret"])), operationValue =>
    then(readField(state, values, "pointee", typeIdentity), pointeeValue =>
    then(readField(state, values, "layout", layoutRef), layoutValue =>
    then(readField(state, values, "context", contextIdentity), contextValue =>
    then(readField(state, values, "bindings", bindings), bindingsValue =>
      finishRecord<RawLocationFact>(state, values, { node: nodeValue, operation: operationValue, pointee: pointeeValue, layout: layoutValue, context: contextValue, bindings: bindingsValue }))))))));
const fieldBinding: Decode<MemoryFieldBindingFact> = (state, input) => then(fields(state, input, "MemoryFieldBindingFact"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "result", typeIdentity), resultValue =>
    then(readField(state, values, "owner", typeIdentity), ownerValue =>
    then(readField(state, values, "fieldExpression", nodeRef), fieldExpressionValue =>
    then(readField(state, values, "field", fieldRef), fieldValue =>
    then(readField(state, values, "pointer", nodeRef), pointerValue =>
    then(readField(state, values, "pointee", typeIdentity), pointeeValue =>
    then(readField(state, values, "context", contextIdentity), contextValue =>
    then(readField(state, values, "bindings", bindings), bindingsValue =>
      finishRecord<MemoryFieldBindingFact>(state, values, { node: nodeValue, result: resultValue, owner: ownerValue, fieldExpression: fieldExpressionValue, field: fieldValue, pointer: pointerValue, pointee: pointeeValue, context: contextValue, bindings: bindingsValue })))))))))));
const boundRecordField: Decode<BoundRecordField> = (state, input) => then(fields(state, input, "BoundRecordField"), values =>
    then(readField(state, values, "expression", nodeRef), expressionValue =>
    then(readField(state, values, "binding", node), bindingValue =>
      finishRecord<BoundRecordField>(state, values, { expression: expressionValue, binding: bindingValue }))));
const recordBinding: Decode<MemoryRecordBindingFact> = (state, input) => then(fields(state, input, "MemoryRecordBindingFact"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "result", typeIdentity), resultValue =>
    then(readField(state, values, "layoutExpression", nodeRef), layoutExpressionValue =>
    then(readField(state, values, "layout", layoutRef), layoutValue =>
    then(readField(state, values, "context", contextIdentity), contextValue =>
    then(readField(state, values, "bindings", bindings), bindingsValue =>
    then(readField(state, values, "fields", (state, input) => sequence(state, input, boundRecordField)), fieldsValue =>
      finishRecord<MemoryRecordBindingFact>(state, values, { node: nodeValue, result: resultValue, layoutExpression: layoutExpressionValue, layout: layoutValue, context: contextValue, bindings: bindingsValue, fields: fieldsValue })))))))));
const bodyFacts: Decode<BodyFacts> = (state, input) => then(fields(state, input, "BodyFacts"), values =>
    then(readField(state, values, "execution", execution), executionValue =>
    then(readField(state, values, "arena", arena), arenaValue =>
    then(readField(state, values, "liveness", liveness), livenessValue =>
    then(readField(state, values, "initialization", initialization), initializationValue =>
    then(readField(state, values, "refinements", refinements), refinementsValue =>
    then(readField(state, values, "origins", originFacts), originsValue =>
    then(readField(state, values, "suspension", suspension), suspensionValue =>
    then(readField(state, values, "errorStorage", errorStorage), errorStorageValue =>
    then(readField(state, values, "pointerBacking", pointerBacking), pointerBackingValue =>
    then(readField(state, values, "rawLocations", (state, input) => sequence(state, input, rawLocation)), rawLocationsValue =>
    then(readField(state, values, "fieldBindings", (state, input) => sequence(state, input, fieldBinding)), fieldBindingsValue =>
    then(readField(state, values, "recordBindings", (state, input) => sequence(state, input, recordBinding)), recordBindingsValue =>
    then(readField(state, values, "memoryBindings", (state, input) => sequence(state, input, memoryInventory)), memoryBindingsValue =>
    then(readField(state, values, "selectedMemoryDeclarations", (state, input) => sequence(state, input, definition)), selectedMemoryDeclarationsValue =>
    then(readField(state, values, "closedArrays", (state, input) => sequence(state, input, closedArray)), closedArraysValue =>
      finishRecord<BodyFacts>(state, values, { execution: executionValue, arena: arenaValue, liveness: livenessValue, initialization: initializationValue, refinements: refinementsValue, origins: originsValue, suspension: suspensionValue, errorStorage: errorStorageValue, pointerBacking: pointerBackingValue, rawLocations: rawLocationsValue, fieldBindings: fieldBindingsValue, recordBindings: recordBindingsValue, memoryBindings: memoryBindingsValue, selectedMemoryDeclarations: selectedMemoryDeclarationsValue, closedArrays: closedArraysValue })))))))))))))))));
const parameterEffect: Decode<ParameterEffect> = (state, input) => then(fields(state, input, "ParameterEffect"), values =>
    then(readField(state, values, "slot", parameterSlot), slotValue =>
    then(readField(state, values, "reads", effectPaths), readsValue =>
    then(readField(state, values, "writes", effectPaths), writesValue =>
      finishRecord<ParameterEffect>(state, values, { slot: slotValue, reads: readsValue, writes: writesValue })))));
const captureEffect: Decode<CaptureEffect> = (state, input) => then(fields(state, input, "CaptureEffect"), values =>
    then(readField(state, values, "index", scalarNumber), indexValue =>
    then(readField(state, values, "reads", effectPaths), readsValue =>
    then(readField(state, values, "writes", effectPaths), writesValue =>
      finishRecord<CaptureEffect>(state, values, { index: indexValue, reads: readsValue, writes: writesValue })))));
const summaryWrite: Decode<SummaryWrite> = (state, input) => then(fields(state, input, "SummaryWrite"), values =>
    then(readField(state, values, "target", producerIdentity), targetValue =>
    then(readField(state, values, "value", originsIdentity), valueValue =>
      finishRecord<SummaryWrite>(state, values, { target: targetValue, value: valueValue }))));
const summaryCallback: Decode<SummaryCallback> = (state, input) => then(fields(state, input, "SummaryCallback"), values =>
    then(readField(state, values, "parameterIndex", scalarNumber), parameterIndexValue =>
    then(readField(state, values, "timing", (state, input) => literal(state, input, ["synchronous","deferred"])), timingValue =>
    then(readField(state, values, "rejection", (state, input) => nullable(state, input, scalarNumber)), rejectionValue =>
    then(readField(state, values, "inputs", (state, input) => sequence(state, input, callbackInput)), inputsValue =>
      finishRecord<SummaryCallback>(state, values, { parameterIndex: parameterIndexValue, timing: timingValue, rejection: rejectionValue, inputs: inputsValue }))))));
const summary: Decode<Summary> = (state, input) => then(fields(state, input, "Summary"), values =>
    then(readField(state, values, "key", summaryKey), keyValue =>
    then(readField(state, values, "signature", signature), signatureValue =>
    then(readField(state, values, "arena", arena), arenaValue =>
    then(readField(state, values, "parameters", (state, input) => sequence(state, input, parameterEffect)), parametersValue =>
    then(readField(state, values, "captures", (state, input) => sequence(state, input, captureEffect)), capturesValue =>
    then(readField(state, values, "result", originsIdentity), resultValue =>
    then(readField(state, values, "thrown", originsIdentity), thrownValue =>
    then(readField(state, values, "writes", (state, input) => sequence(state, input, summaryWrite)), writesValue =>
    then(readField(state, values, "retention", (state, input) => sequence(state, input, retention)), retentionValue =>
    then(readField(state, values, "callbacks", (state, input) => sequence(state, input, summaryCallback)), callbacksValue =>
    then(readField(state, values, "invocationOnlyParameters", (state, input) => sequence(state, input, scalarNumber)), invocationOnlyParametersValue =>
    then(readField(state, values, "suspends", scalarBoolean), suspendsValue =>
    then(readField(state, values, "bindingDependent", scalarBoolean), bindingDependentValue =>
      finishRecord<Summary>(state, values, { key: keyValue, signature: signatureValue, arena: arenaValue, parameters: parametersValue, captures: capturesValue, result: resultValue, thrown: thrownValue, writes: writesValue, retention: retentionValue, callbacks: callbacksValue, invocationOnlyParameters: invocationOnlyParametersValue, suspends: suspendsValue, bindingDependent: bindingDependentValue })))))))))))))));
const callComponent: Decode<CallComponent> = (state, input) => then(fields(state, input, "CallComponent"), values =>
    then(readField(state, values, "id", component), idValue =>
    then(readField(state, values, "definitions", (state, input) => sequence(state, input, definition)), definitionsValue =>
    then(readField(state, values, "dependencies", (state, input) => sequence(state, input, component)), dependenciesValue =>
      finishRecord<CallComponent>(state, values, { id: idValue, definitions: definitionsValue, dependencies: dependenciesValue })))));
const callEdge: Decode<CallEdge> = (state, input) => then(label(input, ["direct","indirect","getter","setter","constructor","initializer","callback"]), kind =>
  then(fields(state, input, kind), values =>
    then(readField(state, values, "caller", definition), caller =>
    then(readField(state, values, "at", nodeRef), at =>
      readField(state, values, "callee", (state, input) =>
        then(label(input, ["definition","open"]), calleeKind =>
          then(fields(state, input, calleeKind), callee => {
            switch (calleeKind) {
              case "definition": return then(readField(state, callee, "definition", definition), definition =>
                then(finishRecord(state, callee, definition), selected =>
                  then(readField(state, values, "bindings", artifact), bindings =>
                    finishRecord<CallEdge>(state, values, { kind, caller, at, callee: { kind: calleeKind, definition: selected }, bindings }))));
              case "open": return then(readField(state, callee, "boundary", boundaryRef), boundary =>
                then(finishRecord(state, callee, boundary), selected =>
                  then(readField(state, values, "bindings", artifact), bindings =>
                    finishRecord<CallEdge>(state, values, { kind, caller, at, callee: { kind: calleeKind, boundary: selected }, bindings }))));
            }
          })))))));

const callGraph: Decode<CallGraph> = (state, input) => then(fields(state, input, "CallGraph"), values =>
    then(readField(state, values, "definitions", (state, input) => sequence(state, input, definition)), definitionsValue =>
    then(readField(state, values, "edges", (state, input) => sequence(state, input, callEdge)), edgesValue =>
    then(readField(state, values, "components", (state, input) => sequence(state, input, callComponent)), componentsValue =>
      finishRecord<CallGraph>(state, values, { definitions: definitionsValue, edges: edgesValue, components: componentsValue })))));
const itemRef: Decode<ItemNodeRef> = (state, input) => then(fields(state, input, "ItemNodeRef"), values =>
    then(readField(state, values, "owner", definition), ownerValue =>
    then(readField(state, values, "node", node), nodeValue =>
      finishRecord<ItemNodeRef>(state, values, { owner: ownerValue, node: nodeValue }))));
const sourceRef: Decode<SourceNodeRef> = (state, input) => then(label(input, ["body","item"]), kind => {
  switch (kind) {
    case "body": return then(fields(state, input, "body"), values =>
    then(readField(state, values, "value", nodeRef), valueValue =>
      finishRecord<SourceNodeRef>(state, values, { kind: "body", value: valueValue })));
    case "item": return then(fields(state, input, "item"), values =>
    then(readField(state, values, "value", itemRef), valueValue =>
      finishRecord<SourceNodeRef>(state, values, { kind: "item", value: valueValue })));
  }
});
const typeBinding: Decode<TypeBinding> = (state, input) => then(label(input, ["bound","rigid"]), kind => {
  switch (kind) {
    case "bound": return then(fields(state, input, "bound"), values =>
    then(readField(state, values, "parameter", parameterIdentity), parameterValue =>
    then(readField(state, values, "type", typeIdentity), typeValue =>
      finishRecord<TypeBinding>(state, values, { kind: "bound", parameter: parameterValue, type: typeValue }))));
    case "rigid": return then(fields(state, input, "rigid"), values =>
    then(readField(state, values, "parameter", parameterIdentity), parameterValue =>
      finishRecord<TypeBinding>(state, values, { kind: "rigid", parameter: parameterValue })));
  }
});
const selfBinding: Decode<SelfBinding> = (state, input) => then(label(input, ["bound","rigid"]), kind => {
  switch (kind) {
    case "bound": return then(fields(state, input, "bound"), values =>
    then(readField(state, values, "owner", definition), ownerValue =>
    then(readField(state, values, "type", typeIdentity), typeValue =>
      finishRecord<SelfBinding>(state, values, { kind: "bound", owner: ownerValue, type: typeValue }))));
    case "rigid": return then(fields(state, input, "rigid"), values =>
    then(readField(state, values, "owner", definition), ownerValue =>
      finishRecord<SelfBinding>(state, values, { kind: "rigid", owner: ownerValue })));
  }
});
const artifact: Decode<ArtifactBindings> = (state, input) => then(label(input, ["parametric","instantiated"]), kind => {
  switch (kind) {
    case "parametric": return then(fields(state, input, "parametric"), values =>
      finishRecord<ArtifactBindings>(state, values, { kind: "parametric" }));
    case "instantiated": return then(fields(state, input, "instantiated"), values =>
    then(readField(state, values, "bindings", bindings), bindingsValue =>
      finishRecord<ArtifactBindings>(state, values, { kind: "instantiated", bindings: bindingsValue })));
  }
});
const memberKey: Decode<MemberKey> = (state, input) => then(label(input, ["text","number","symbol"]), kind => {
  switch (kind) {
    case "text": return then(fields(state, input, "text"), values =>
    then(readField(state, values, "value", scalarString), valueValue =>
      finishRecord<MemberKey>(state, values, { kind: "text", value: valueValue })));
    case "number": return then(fields(state, input, "number"), values =>
    then(readField(state, values, "value", rational), valueValue =>
      finishRecord<MemberKey>(state, values, { kind: "number", value: valueValue })));
    case "symbol": return then(fields(state, input, "symbol"), values =>
    then(readField(state, values, "declaration", definition), declarationValue =>
      finishRecord<MemberKey>(state, values, { kind: "symbol", declaration: declarationValue })));
  }
});
const memberOrigin: Decode<MemberOrigin> = (state, input) => then(label(input, ["declared","class-prototype","mapped"]), kind => {
  switch (kind) {
    case "declared": return then(fields(state, input, "declared"), values =>
    then(readField(state, values, "declaration", definition), declarationValue =>
      finishRecord<MemberOrigin>(state, values, { kind: "declared", declaration: declarationValue })));
    case "class-prototype": return then(fields(state, input, "class-prototype"), values =>
    then(readField(state, values, "owner", definition), ownerValue =>
      finishRecord<MemberOrigin>(state, values, { kind: "class-prototype", owner: ownerValue })));
    case "mapped": return then(fields(state, input, "mapped"), values =>
    then(readField(state, values, "owner", sourceRef), ownerValue =>
    then(readField(state, values, "key", memberKey), keyValue =>
      finishRecord<MemberOrigin>(state, values, { kind: "mapped", owner: ownerValue, key: keyValue }))));
  }
});
const owner: Decode<RelationalOwner> = (state, input) => then(label(input, ["body", "summary"]), kind =>
  then(fields(state, input, kind), values => kind === "body"
    ? then(readField(state, values, "execution", execution), selected =>
      finishRecord<RelationalOwner>(state, values, { kind, execution: selected }))
    : then(readField(state, values, "key", summaryKey), key =>
      finishRecord<RelationalOwner>(state, values, { kind, key }))));
const site: Decode<RelationalSite> = (state, input) => then(label(input, ["node","declared"]), kind => {
  switch (kind) {
    case "node": return then(fields(state, input, "node"), values =>
    then(readField(state, values, "node", sourceRef), nodeValue =>
      finishRecord<RelationalSite>(state, values, { kind: "node", node: nodeValue })));
    case "declared": return then(fields(state, input, "declared"), values =>
    then(readField(state, values, "identity", libraryExport), identityValue =>
    then(readField(state, values, "site", scalarNumber), siteValue =>
      finishRecord<RelationalSite>(state, values, { kind: "declared", identity: identityValue, site: siteValue }))));
  }
});
const projection: Decode<Projection> = (state, input) => then(label(input, ["field","method-value","element","index","deref"]), kind => {
  switch (kind) {
    case "field": return then(fields(state, input, "field"), values =>
    then(readField(state, values, "member", memberSelection), memberValue =>
      finishRecord<Projection>(state, values, { kind: "field", member: memberValue })));
    case "method-value": return then(fields(state, input, "method-value"), values =>
    then(readField(state, values, "member", memberSelection), memberValue =>
      finishRecord<Projection>(state, values, { kind: "method-value", member: memberValue })));
    case "element": return then(fields(state, input, "element"), values =>
      finishRecord<Projection>(state, values, { kind: "element" }));
    case "index": return then(fields(state, input, "index"), values =>
    then(readField(state, values, "constant", scalarBigint), constantValue =>
      finishRecord<Projection>(state, values, { kind: "index", constant: constantValue })));
    case "deref": return then(fields(state, input, "deref"), values =>
      finishRecord<Projection>(state, values, { kind: "deref" }));
  }
});
const producer: Decode<Producer> = (state, input) => then(label(input, ["allocation","parameter","receiver","capture","shared","suspension-input","call-result"]), kind => {
  switch (kind) {
    case "allocation": return then(fields(state, input, kind), values =>
      then(readField(state, values, "id", producerIdentity), id =>
      then(readField(state, values, "path", (state, input) => nullable(state, input, path)), path =>
      then(readField(state, values, "at", site), at =>
        finishRecord<Producer>(state, values, { kind, id, path, at })))));
    case "parameter": case "capture": return then(fields(state, input, kind), values =>
      then(readField(state, values, "id", producerIdentity), id =>
      then(readField(state, values, "path", (state, input) => nullable(state, input, path)), path =>
      then(readField(state, values, "index", scalarNumber), index =>
        finishRecord<Producer>(state, values, { kind, id, path, index })))));
    case "receiver": return then(fields(state, input, kind), values =>
      then(readField(state, values, "id", producerIdentity), id =>
      then(readField(state, values, "path", (state, input) => nullable(state, input, path)), path =>
        finishRecord<Producer>(state, values, { kind, id, path }))));
    case "shared": return then(fields(state, input, kind), values =>
      then(readField(state, values, "id", producerIdentity), id =>
      then(readField(state, values, "path", (state, input) => nullable(state, input, path)), path =>
      then(readField(state, values, "definition", definition), definition =>
        finishRecord<Producer>(state, values, { kind, id, path, definition })))));
    case "suspension-input": return then(fields(state, input, kind), values =>
      then(readField(state, values, "id", producerIdentity), id =>
      then(readField(state, values, "path", (state, input) => nullable(state, input, path)), path =>
      then(readField(state, values, "at", nodeRef), at =>
      then(readField(state, values, "channel", (state, input) => literal(state, input, ["sent","return","thrown"])), channel =>
        finishRecord<Producer>(state, values, { kind, id, path, at, channel }))))));
    case "call-result": return then(fields(state, input, kind), values =>
      then(readField(state, values, "id", producerIdentity), id =>
      then(readField(state, values, "path", (state, input) => nullable(state, input, path)), path =>
      then(readField(state, values, "at", nodeRef), at =>
        readField(state, values, "callee", (state, input) =>
          then(label(input, ["direct","indirect"]), calleeKind =>
            then(fields(state, input, calleeKind), callee => {
              switch (calleeKind) {
                case "direct": return then(readField(state, callee, "definition", definition), definition =>
                  then(finishRecord(state, callee, definition), selected =>
                    finishRecord<Producer>(state, values, { kind, id, path, at, callee: { kind: calleeKind, definition: selected } })));
                case "indirect": return then(finishRecord(state, callee, null), () =>
                  finishRecord<Producer>(state, values, { kind, id, path, at, callee: { kind: calleeKind } }));
              }
            })))))));
  }
});

const origins: Decode<Origins> = (state, input) => then(label(input, ["complete","open"]), kind => {
  switch (kind) {
    case "complete": return then(fields(state, input, "complete"), values =>
    then(readField(state, values, "id", originsIdentity), idValue =>
    then(readField(state, values, "producers", (state, input) => sequence(state, input, bound)), producersValue =>
    then(readField(state, values, "includesAbsence", scalarBoolean), includesAbsenceValue =>
      finishRecord<Origins>(state, values, { kind: "complete", id: idValue, producers: producersValue, includesAbsence: includesAbsenceValue })))));
    case "open": return then(fields(state, input, "open"), values =>
    then(readField(state, values, "id", originsIdentity), idValue =>
    then(readField(state, values, "producers", (state, input) => sequence(state, input, bound)), producersValue =>
    then(readField(state, values, "includesAbsence", scalarBoolean), includesAbsenceValue =>
    then(readField(state, values, "boundaries", (state, input) => nonempty(state, input, boundary)), boundariesValue =>
      finishRecord<Origins>(state, values, { kind: "open", id: idValue, producers: producersValue, includesAbsence: includesAbsenceValue, boundaries: boundariesValue }))))));
  }
});
const refinementReason: Decode<RefinementReason> = (state, input) => then(label(input, ["invalidated","guard-not-proven"]), kind => {
  switch (kind) {
    case "invalidated": return then(fields(state, input, "invalidated"), values =>
    then(readField(state, values, "sites", (state, input) => nonempty(state, input, refinementInvalidation)), sitesValue =>
      finishRecord<RefinementReason>(state, values, { kind: "invalidated", sites: sitesValue })));
    case "guard-not-proven": return then(fields(state, input, "guard-not-proven"), values =>
    then(readField(state, values, "detail", scalarString), detailValue =>
      finishRecord<RefinementReason>(state, values, { kind: "guard-not-proven", detail: detailValue })));
  }
});
const refinementFact: Decode<RefinementFact> = (state, input) => then(label(input, ["proven","unproven"]), kind => {
  switch (kind) {
    case "proven": return then(fields(state, input, "proven"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "guards", (state, input) => sequence(state, input, node)), guardsValue =>
      finishRecord<RefinementFact>(state, values, { kind: "proven", node: nodeValue, guards: guardsValue }))));
    case "unproven": return then(fields(state, input, "unproven"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "guards", (state, input) => sequence(state, input, node)), guardsValue =>
    then(readField(state, values, "reason", refinementReason), reasonValue =>
      finishRecord<RefinementFact>(state, values, { kind: "unproven", node: nodeValue, guards: guardsValue, reason: reasonValue })))));
  }
});
const escapeTarget: Decode<EscapeTarget> = (state, input) => then(label(input, ["return","throw","shared","parameter","receiver","capture","callback","suspension","external"]), kind => {
  switch (kind) {
    case "return": return then(fields(state, input, "return"), values =>
      finishRecord<EscapeTarget>(state, values, { kind: "return" }));
    case "throw": return then(fields(state, input, "throw"), values =>
      finishRecord<EscapeTarget>(state, values, { kind: "throw" }));
    case "shared": return then(fields(state, input, "shared"), values =>
    then(readField(state, values, "definition", definition), definitionValue =>
    then(readField(state, values, "path", (state, input) => nullable(state, input, path)), pathValue =>
      finishRecord<EscapeTarget>(state, values, { kind: "shared", definition: definitionValue, path: pathValue }))));
    case "parameter": return then(fields(state, input, "parameter"), values =>
    then(readField(state, values, "index", scalarNumber), indexValue =>
    then(readField(state, values, "path", (state, input) => nullable(state, input, path)), pathValue =>
      finishRecord<EscapeTarget>(state, values, { kind: "parameter", index: indexValue, path: pathValue }))));
    case "receiver": return then(fields(state, input, "receiver"), values =>
    then(readField(state, values, "path", (state, input) => nullable(state, input, path)), pathValue =>
      finishRecord<EscapeTarget>(state, values, { kind: "receiver", path: pathValue })));
    case "capture": return then(fields(state, input, "capture"), values =>
    then(readField(state, values, "index", scalarNumber), indexValue =>
    then(readField(state, values, "path", (state, input) => nullable(state, input, path)), pathValue =>
      finishRecord<EscapeTarget>(state, values, { kind: "capture", index: indexValue, path: pathValue }))));
    case "callback": return then(fields(state, input, "callback"), values =>
    then(readField(state, values, "at", site), atValue =>
      finishRecord<EscapeTarget>(state, values, { kind: "callback", at: atValue })));
    case "suspension": return then(fields(state, input, "suspension"), values =>
    then(readField(state, values, "at", site), atValue =>
      finishRecord<EscapeTarget>(state, values, { kind: "suspension", at: atValue })));
    case "external": return then(fields(state, input, "external"), values =>
    then(readField(state, values, "boundary", boundary), boundaryValue =>
      finishRecord<EscapeTarget>(state, values, { kind: "external", boundary: boundaryValue })));
  }
});
const callbackInput: Decode<CallbackInput> = (state, input) => then(label(input, ["receiver-element","receiver-rejection","argument-element"]), kind => {
  switch (kind) {
    case "receiver-element": return then(fields(state, input, "receiver-element"), values =>
    then(readField(state, values, "parameterIndex", scalarNumber), parameterIndexValue =>
      finishRecord<CallbackInput>(state, values, { kind: "receiver-element", parameterIndex: parameterIndexValue })));
    case "receiver-rejection": return then(fields(state, input, "receiver-rejection"), values =>
    then(readField(state, values, "parameterIndex", scalarNumber), parameterIndexValue =>
      finishRecord<CallbackInput>(state, values, { kind: "receiver-rejection", parameterIndex: parameterIndexValue })));
    case "argument-element": return then(fields(state, input, "argument-element"), values =>
    then(readField(state, values, "parameterIndex", scalarNumber), parameterIndexValue =>
    then(readField(state, values, "sourceParameterIndex", scalarNumber), sourceParameterIndexValue =>
      finishRecord<CallbackInput>(state, values, { kind: "argument-element", parameterIndex: parameterIndexValue, sourceParameterIndex: sourceParameterIndexValue }))));
  }
});
const errorReason: Decode<ErrorInvalidationReason> = (state, input) => then(label(input, ["incomplete-origins","inexact-accessor-footprint","open-constructor-domain","opaque-invocation-footprint"]), kind => {
  switch (kind) {
    case "incomplete-origins": return then(fields(state, input, "incomplete-origins"), values =>
    then(readField(state, values, "affected", originsIdentity), affectedValue =>
      finishRecord<ErrorInvalidationReason>(state, values, { kind: "incomplete-origins", affected: affectedValue })));
    case "inexact-accessor-footprint": return then(fields(state, input, "inexact-accessor-footprint"), values =>
      finishRecord<ErrorInvalidationReason>(state, values, { kind: "inexact-accessor-footprint" }));
    case "open-constructor-domain": return then(fields(state, input, "open-constructor-domain"), values =>
    then(readField(state, values, "constructor", originsIdentity), constructorValue =>
      finishRecord<ErrorInvalidationReason>(state, values, { kind: "open-constructor-domain", constructor: constructorValue })));
    case "opaque-invocation-footprint": return then(fields(state, input, "opaque-invocation-footprint"), values =>
    then(readField(state, values, "affected", originsIdentity), affectedValue =>
      finishRecord<ErrorInvalidationReason>(state, values, { kind: "opaque-invocation-footprint", affected: affectedValue })));
  }
});
const memoryLayout: Decode<MemoryLayout> = (state, input) => then(label(input, ["value","array"]), kind => {
  switch (kind) {
    case "value": return then(fields(state, input, "value"), values =>
    then(readField(state, values, "id", layout), idValue =>
    then(readField(state, values, "occurrence", sourceRef), occurrenceValue =>
    then(readField(state, values, "source", typeIdentity), sourceValue =>
    then(readField(state, values, "dataLayout", definition), dataLayoutValue =>
    then(readField(state, values, "byteSize", scalarBigint), byteSizeValue =>
    then(readField(state, values, "byteAlignment", scalarBigint), byteAlignmentValue =>
    then(readField(state, values, "stride", scalarBigint), strideValue =>
    then(readField(state, values, "fields", (state, input) => sequence(state, input, field)), fieldsValue =>
      finishRecord<MemoryLayout>(state, values, { kind: "value", id: idValue, occurrence: occurrenceValue, source: sourceValue, dataLayout: dataLayoutValue, byteSize: byteSizeValue, byteAlignment: byteAlignmentValue, stride: strideValue, fields: fieldsValue }))))))))));
    case "array": return then(fields(state, input, "array"), values =>
    then(readField(state, values, "id", layout), idValue =>
    then(readField(state, values, "occurrence", sourceRef), occurrenceValue =>
    then(readField(state, values, "source", typeIdentity), sourceValue =>
    then(readField(state, values, "dataLayout", definition), dataLayoutValue =>
    then(readField(state, values, "byteSize", scalarBigint), byteSizeValue =>
    then(readField(state, values, "byteAlignment", scalarBigint), byteAlignmentValue =>
    then(readField(state, values, "stride", scalarBigint), strideValue =>
    then(readField(state, values, "length", scalarBigint), lengthValue =>
    then(readField(state, values, "runtimeBase", (state, input) => literal(state, input, ["number","bigint"])), runtimeBaseValue =>
    then(readField(state, values, "element", layout), elementValue =>
      finishRecord<MemoryLayout>(state, values, { kind: "array", id: idValue, occurrence: occurrenceValue, source: sourceValue, dataLayout: dataLayoutValue, byteSize: byteSizeValue, byteAlignment: byteAlignmentValue, stride: strideValue, length: lengthValue, runtimeBase: runtimeBaseValue, element: elementValue }))))))))))));
  }
});
const metadata: Decode<MetadataRecord> = (state, input) => then(label(input, ["data-layout","memory-layout","memory-field"]), kind => {
  switch (kind) {
    case "data-layout": return then(fields(state, input, "data-layout"), values =>
    then(readField(state, values, "key", metadataKey), keyValue =>
    then(readField(state, values, "occurrence", sourceRef), occurrenceValue =>
    then(readField(state, values, "fingerprint", scalarString), fingerprintValue =>
    then(readField(state, values, "byteOrder", (state, input) => literal(state, input, ["little","big"])), byteOrderValue =>
    then(readField(state, values, "addressWidth", (state, input) => literal(state, input, [32, 64])), addressWidthValue =>
      finishRecord<MetadataRecord>(state, values, { kind: "data-layout", key: keyValue, occurrence: occurrenceValue, fingerprint: fingerprintValue, byteOrder: byteOrderValue, addressWidth: addressWidthValue })))))));
    case "memory-layout": return then(fields(state, input, "memory-layout"), values =>
    then(readField(state, values, "key", metadataKey), keyValue =>
    then(readField(state, values, "root", layout), rootValue =>
    then(readField(state, values, "layouts", (state, input) => sequence(state, input, memoryLayout)), layoutsValue =>
    then(readField(state, values, "fields", (state, input) => sequence(state, input, memoryField)), fieldsValue =>
      finishRecord<MetadataRecord>(state, values, { kind: "memory-layout", key: keyValue, root: rootValue, layouts: layoutsValue, fields: fieldsValue }))))));
    case "memory-field": return then(fields(state, input, "memory-field"), values =>
    then(readField(state, values, "key", metadataKey), keyValue =>
    then(readField(state, values, "root", field), rootValue =>
    then(readField(state, values, "layouts", (state, input) => sequence(state, input, memoryLayout)), layoutsValue =>
    then(readField(state, values, "fields", (state, input) => sequence(state, input, memoryField)), fieldsValue =>
      finishRecord<MetadataRecord>(state, values, { kind: "memory-field", key: keyValue, root: rootValue, layouts: layoutsValue, fields: fieldsValue }))))));
  }
});
const memoryInventory: Decode<MemoryBindingInventoryEntry> = (state, input) => then(label(input, ["bound","error"]), kind => {
  switch (kind) {
    case "bound": return then(fields(state, input, "bound"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "record", node), recordValue =>
      finishRecord<MemoryBindingInventoryEntry>(state, values, { kind: "bound", node: nodeValue, record: recordValue }))));
    case "error": return then(fields(state, input, "error"), values =>
    then(readField(state, values, "node", node), nodeValue =>
      finishRecord<MemoryBindingInventoryEntry>(state, values, { kind: "error", node: nodeValue })));
  }
});
const closedReason: Decode<ClosedArrayReason> = (state, input) => then(label(input, ["not-local-element-access","open-origin-domain","nonlocal-or-projected-origin","sparse-or-spread-literal","callable-boundary","alias-declaration-missing","different-origin-domain","binding-not-plain","initialization-not-block-local","unproven-capture","assignment-result-exposed","unproven-use","no-local-allocation"]), kind => {
  switch (kind) {
    case "not-local-element-access": return then(fields(state, input, "not-local-element-access"), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "not-local-element-access", at: atValue })));
    case "open-origin-domain": return then(fields(state, input, "open-origin-domain"), values =>
    then(readField(state, values, "origins", originsIdentity), originsValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "open-origin-domain", origins: originsValue })));
    case "nonlocal-or-projected-origin": return then(fields(state, input, "nonlocal-or-projected-origin"), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "nonlocal-or-projected-origin", at: atValue })));
    case "sparse-or-spread-literal": return then(fields(state, input, "sparse-or-spread-literal"), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "sparse-or-spread-literal", at: atValue })));
    case "callable-boundary": return then(fields(state, input, "callable-boundary"), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "callable-boundary", at: atValue })));
    case "alias-declaration-missing": return then(fields(state, input, "alias-declaration-missing"), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "alias-declaration-missing", at: atValue })));
    case "different-origin-domain": return then(fields(state, input, "different-origin-domain"), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "different-origin-domain", at: atValue })));
    case "binding-not-plain": return then(fields(state, input, "binding-not-plain"), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "binding-not-plain", at: atValue })));
    case "initialization-not-block-local": return then(fields(state, input, "initialization-not-block-local"), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "initialization-not-block-local", at: atValue })));
    case "unproven-capture": return then(fields(state, input, "unproven-capture"), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "unproven-capture", at: atValue })));
    case "assignment-result-exposed": return then(fields(state, input, "assignment-result-exposed"), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "assignment-result-exposed", at: atValue })));
    case "unproven-use": return then(fields(state, input, "unproven-use"), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "unproven-use", at: atValue })));
    case "no-local-allocation": return then(fields(state, input, "no-local-allocation"), values =>
    then(readField(state, values, "at", nodeRef), atValue =>
      finishRecord<ClosedArrayReason>(state, values, { kind: "no-local-allocation", at: atValue })));
  }
});
const declarationTarget: Decode<DeclarationTarget> = (state, input) => then(label(input, ["local","definition"]), kind => {
  switch (kind) {
    case "local": return then(fields(state, input, "local"), values =>
    then(readField(state, values, "local", localRef), localValue =>
      finishRecord<DeclarationTarget>(state, values, { kind: "local", local: localValue })));
    case "definition": return then(fields(state, input, "definition"), values =>
    then(readField(state, values, "definition", definition), definitionValue =>
      finishRecord<DeclarationTarget>(state, values, { kind: "definition", definition: definitionValue })));
  }
});
const closedArray: Decode<ClosedArrayFact> = (state, input) => then(label(input, ["unproven","closed"]), kind => {
  switch (kind) {
    case "unproven": return then(fields(state, input, "unproven"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "reason", closedReason), reasonValue =>
      finishRecord<ClosedArrayFact>(state, values, { kind: "unproven", node: nodeValue, reason: reasonValue }))));
    case "closed": return then(fields(state, input, "closed"), values =>
    then(readField(state, values, "node", node), nodeValue =>
    then(readField(state, values, "declarations", (state, input) => sequence(state, input, declarationTarget)), declarationsValue =>
    then(readField(state, values, "references", (state, input) => sequence(state, input, nodeRef)), referencesValue =>
    then(readField(state, values, "literals", (state, input) => sequence(state, input, nodeRef)), literalsValue =>
    then(readField(state, values, "elements", (state, input) => sequence(state, input, memberSelection)), elementsValue =>
      finishRecord<ClosedArrayFact>(state, values, { kind: "closed", node: nodeValue, declarations: declarationsValue, references: referencesValue, literals: literalsValue, elements: elementsValue })))))));
  }
});
const effectPaths: Decode<EffectPaths> = (state, input) => then(label(input, ["complete","open"]), kind => {
  switch (kind) {
    case "complete": return then(fields(state, input, "complete"), values =>
    then(readField(state, values, "paths", (state, input) => sequence(state, input, path)), pathsValue =>
      finishRecord<EffectPaths>(state, values, { kind: "complete", paths: pathsValue })));
    case "open": return then(fields(state, input, "open"), values =>
    then(readField(state, values, "paths", (state, input) => sequence(state, input, path)), pathsValue =>
    then(readField(state, values, "boundaries", (state, input) => nonempty(state, input, boundary)), boundariesValue =>
      finishRecord<EffectPaths>(state, values, { kind: "open", paths: pathsValue, boundaries: boundariesValue }))));
  }
});
const parameterSlot: Decode<ParameterSlot> = (state, input) => then(label(input, ["receiver","parameter"]), kind => {
  switch (kind) {
    case "receiver": return then(fields(state, input, "receiver"), values =>
      finishRecord<ParameterSlot>(state, values, { kind: "receiver" }));
    case "parameter": return then(fields(state, input, "parameter"), values =>
    then(readField(state, values, "index", scalarNumber), indexValue =>
      finishRecord<ParameterSlot>(state, values, { kind: "parameter", index: indexValue })));
  }
});
const parameterMapping: Decode<ParameterMapping> = (state, input) => then(label(input, ["argument","default","omitted","rest"]), kind => {
  switch (kind) {
    case "argument": return then(fields(state, input, "argument"), values =>
    then(readField(state, values, "parameter", scalarNumber), parameterValue =>
    then(readField(state, values, "argument", scalarNumber), argumentValue =>
    then(readField(state, values, "component", (state, input) => nullable(state, input, scalarNumber)), componentValue =>
    then(readField(state, values, "passing", (state, input) => literal(state, input, ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"])), passingValue =>
      finishRecord<ParameterMapping>(state, values, { kind: "argument", parameter: parameterValue, argument: argumentValue, component: componentValue, passing: passingValue }))))));
    case "default": return then(fields(state, input, "default"), values =>
    then(readField(state, values, "parameter", scalarNumber), parameterValue =>
    then(readField(state, values, "initializer", body), initializerValue =>
      finishRecord<ParameterMapping>(state, values, { kind: "default", parameter: parameterValue, initializer: initializerValue }))));
    case "omitted": return then(fields(state, input, "omitted"), values =>
    then(readField(state, values, "parameter", scalarNumber), parameterValue =>
    then(readField(state, values, "type", typeIdentity), typeValue =>
      finishRecord<ParameterMapping>(state, values, { kind: "omitted", parameter: parameterValue, type: typeValue }))));
    case "rest": return then(fields(state, input, "rest"), values =>
    then(readField(state, values, "parameter", scalarNumber), parameterValue =>
    then(readField(state, values, "arguments", (state, input) => sequence(state, input, scalarNumber)), argumentsValue =>
    then(readField(state, values, "passing", (state, input) => literal(state, input, ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"])), passingValue =>
      finishRecord<ParameterMapping>(state, values, { kind: "rest", parameter: parameterValue, arguments: argumentsValue, passing: passingValue })))));
  }
});

const pointerOperation: Decode<PointerBackingOperation> = (state, input) =>
  then(fields(state, input, "PointerBackingOperation"), values =>
    then(readField(state, values, "family", (state, input) => literal(state, input, ["typed-location", "raw-memory"])), family => {
      switch (family) {
        case "raw-memory": return then(readField(state, values, "operation", (state, input) => literal(state, input, ["reinterpret"])), operation =>
          then(readField(state, values, "at", nodeRef), at => finishRecord<PointerBackingOperation>(state, values, { family, operation, at })));
        case "typed-location": return then(readField(state, values, "operation", (state, input) => literal(state, input, ["allocate", "address-of", "bind-pointer", "project-pointer"])), operation =>
          then(readField(state, values, "at", nodeRef), at => finishRecord<PointerBackingOperation>(state, values, { family, operation, at })));
      }
    }));

const errorInvalidation: Decode<ErrorInvalidationFact> = (state, input) =>
  then(label(input, ["preserved", "invalidated", "unproven"]), kind =>
    then(fields(state, input, kind), values =>
      then(readField(state, values, "at", nodeRef), at =>
      then(readField(state, values, "owner", originsIdentity), owner => {
        switch (kind) {
          case "preserved": return finishRecord<ErrorInvalidationFact>(state, values, { kind, at, owner });
          case "unproven": return then(readField(state, values, "reason", errorReason), reason =>
            then(readField(state, values, "detail", scalarString), detail =>
              finishRecord<ErrorInvalidationFact>(state, values, { kind, at, owner, reason, detail })));
          case "invalidated": return then(readField(state, values, "cause", (state, input) => literal(state, input, ["suspension", "overlapping-write"])), cause => {
            switch (cause) {
              case "suspension": return finishRecord<ErrorInvalidationFact>(state, values, { kind, at, owner, cause });
              case "overlapping-write": return then(readField(state, values, "affected", originsIdentity), affected =>
                finishRecord<ErrorInvalidationFact>(state, values, { kind, at, owner, cause, affected }));
            }
          });
        }
      }))));

const parse = <Value>(text: string, decode: Decode<Value>): TextParseResult<Value> => {
  const state: State = { text, offset: 0, lookahead: null };
  const decoded = then(decode(state, peek(state)), value => {
    const next = peek(state);
    return next.kind === "end" ? accept(value) : fail(next, ["end of document"]);
  });
  if (decoded.kind === "value") return { kind: "parsed", value: decoded.value };
  const failure = decoded.failure;
  let line = 1;
  let column = 1;
  for (let offset = 0; offset < failure.offset; offset += 1) {
    const unit = text.charCodeAt(offset);
    if (unit === 13 || unit === 0x2028 || unit === 0x2029) { line += 1; column = 1; }
    else if (unit === 10) { if (text.charCodeAt(offset - 1) !== 13) line += 1; column = 1; }
    else column += 1;
  }
  return { kind: "invalid-text", offset: failure.offset, line, column, expected: failure.expected, found: failure.found };
};

export const parseFacts: ParseFacts = text => parse(text, bodyFacts);
export const parseObservations: ParseObservations = text => parse(text, bodyObservations);
export const parseSummary: ParseSummary = text => parse(text, summary);
export const parseMetadata: ParseMetadata = text => parse(text, metadata);
export const parseCallGraph: ParseCallGraph = text => parse(text, callGraph);
