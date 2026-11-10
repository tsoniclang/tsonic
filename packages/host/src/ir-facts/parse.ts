import type { TextParseResult } from "../diag/contract.js";
import type {
  BlockId, BoundProducerId, ComponentId, DefId, LayoutId, LibraryExportIdentity, LibraryModuleIdentity,
  LocalId, LocalRef, MemoryFieldId, NodeId, NodeRef, OpenBoundaryId, OriginsId, PlaceId, ProducerId,
  ProjectionPathId, SigId, SourceNodeRef, TyId, ValueContextId, BodyId,
} from "../ids/contract.js";
import { decodeBodyId, decodeComponentId, decodeDefId, encodeBodyId, encodeComponentId, encodeDefId } from "../ids/index.js";
import type { HirCallableEndpoint } from "../ir-hir/contract.js";
import type { ApplicationDecision, CompletionEndpoint, MemberDecision, ParameterMapping } from "../ir-infer/contract.js";
import type { MemberSelection, ResolvedCallee } from "../ir-tir/contract.js";
import type {
  ArtifactBindings, BindingVector, BodyInstance, ExactRational, MemberKey, MemberOrigin, SelfBinding,
  TypeBinding, TypeParameterIdentity,
} from "../ir-types/contract.js";
import type { CallbackInput, SummaryCallback } from "../snapshot/contract.js";
import type {
  ArgumentTransport, BindingStorageFact, BodyFacts, BoundActivation, BoundProducer, BoundRecordField,
  CallbackEntry, CallComponent, CallEdge, CallGraph, CaptureEffect, CaptureFact, CaptureLocation,
  ClosedArrayFact, ClosedArrayReason, ConstructionAlternative, CountedLoopFact, EffectPaths,
  ErrorInvalidationFact, ErrorInvalidationReason, ErrorStorageFact, ErrorStorageFacts, EscapeFact, EscapeTarget,
  InitializationFact, InitializationFacts, InstanceRegion, IntegerFact, IntegerRange, InvocationAlternative, InvocationFact,
  LiveSegment, LivenessFacts, LocalLiveRange, MemoryBindingInventoryEntry, MemoryField, MemoryFieldBindingFact,
  MemoryLayout, MemoryRecordBindingFact, MetadataFieldRef, MetadataKey, MetadataLayoutRef, MetadataRecord,
  MirPoint, ObservationFact, OpenBoundary, OpenBoundaryRef, OriginFacts, Origins, ParameterEffect, ParameterSlot,
  PointPlaceOrigins, PointerBackingFact, PointerBackingFacts, PointerBackingOperation, PointerBackingProducer,
  ParseCallGraph, ParseFacts, ParseMetadata, ParseSummary, Producer, ProducerRef, Projection, ProjectionPath,
  RawLocationFact, ReadOriginsFact, RefinementFact, RefinementFacts, RefinementInvalidation, RefinementReason,
  RelationalArena, RelationalOwner, RelationalSite, RetentionFact, StoreLiveness, SubjectOriginsFact, Summary,
  SummaryKey, SummaryWrite, SuspensionFact, SuspensionFacts, SuspensionValue, ValueContext, ValueFrontier,
  WriteFact, WrittenOrigins, WrittenOriginsReason,
} from "./contract.js";

type Atom = string | number | bigint | boolean | null;
type Token = { readonly kind: "word" | "punctuation"; readonly text: string; readonly offset: number }
  | { readonly kind: "scalar"; readonly text: string; readonly offset: number; readonly value: Atom };
type SyntaxValue = { readonly kind: "scalar"; readonly offset: number; readonly value: Atom }
  | { readonly kind: "identity"; readonly offset: number; readonly prefix: string; readonly value: string | number }
  | { readonly kind: "array"; readonly offset: number; readonly values: readonly SyntaxValue[] }
  | { readonly kind: "record"; readonly offset: number; readonly end: number; readonly label: string; readonly fields: readonly SyntaxField[] };
interface SyntaxField { readonly name: string; readonly offset: number; readonly value: SyntaxValue }
interface Failure { readonly offset: number; readonly expected: readonly string[] }
interface State { readonly text: string; failure: Failure | null }
interface Decoded<Value> { readonly value: Value }
type Decode<Value> = (state: State, input: SyntaxValue | undefined) => Decoded<Value> | null;
type Frame = { readonly kind: "array"; readonly offset: number; readonly values: SyntaxValue[]; phase: "first" | "value" | "separator" }
  | { readonly kind: "record"; readonly offset: number; readonly label: string; readonly fields: SyntaxField[];
      phase: "first" | "field" | "equals" | "value" | "separator"; name: string; fieldOffset: number };

const reject = (state: State, offset: number, expected: readonly string[]): null => {
  if (state.failure === null) state.failure = { offset, expected };
  return null;
};
const fail = (state: State, input: SyntaxValue | undefined, expected: readonly string[]): null =>
  reject(state, input === undefined ? state.text.length : input.offset, expected);
const lex = (state: State): readonly Token[] | null => {
  const tokens: Token[] = [];
  let offset = 0;
  while (offset < state.text.length) {
    const unit = state.text.charCodeAt(offset);
    if (unit === 32 || unit === 9 || unit === 10 || unit === 13) { offset += 1; continue; }
    const start = offset;
    const character = state.text.charAt(offset);
    if ("()[]=,:".includes(character)) {
      tokens.push({ kind: "punctuation", text: character, offset }); offset += 1; continue;
    }
    if (unit === 34) {
      const parts: string[] = [];
      offset += 1;
      let closed = false;
      while (offset < state.text.length) {
        const current = state.text.charCodeAt(offset);
        offset += 1;
        if (current === 34) { closed = true; break; }
        if (current < 32) return reject(state, offset - 1, ["escaped string character"]);
        if (current !== 92) { parts.push(String.fromCharCode(current)); continue; }
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
            if (!/^[0-9a-fA-F]{4}$/.test(digits)) return reject(state, offset, ["four hexadecimal digits"]);
            parts.push(String.fromCharCode(Number.parseInt(digits, 16))); offset += 4; break;
          }
          default: return reject(state, escapeOffset, ["JSON string escape"]);
        }
      }
      if (!closed) return reject(state, offset, ['"']);
      tokens.push({ kind: "scalar", text: state.text.slice(start, offset), offset: start, value: parts.join("") }); continue;
    }
    if (unit === 45 || unit >= 48 && unit <= 57) {
      if (unit === 45) offset += 1;
      while (state.text.charCodeAt(offset) >= 48 && state.text.charCodeAt(offset) <= 57) offset += 1;
      if (state.text.charAt(offset) === "n") {
        offset += 1;
        const text = state.text.slice(start, offset);
        if (!/^-?(?:0|[1-9][0-9]*)n$/.test(text)) return reject(state, start, ["decimal bigint"]);
        tokens.push({ kind: "scalar", text, offset: start, value: BigInt(text.slice(0, -1)) }); continue;
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
        return reject(state, start, ["finite decimal number"]);
      }
      tokens.push({ kind: "scalar", text, offset: start, value }); continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      offset += 1;
      while (/[A-Za-z0-9_-]/.test(state.text.charAt(offset)) && offset < state.text.length) offset += 1;
      const text = state.text.slice(start, offset);
      if (text === "true" || text === "false" || text === "null") {
        tokens.push({ kind: "scalar", text, offset: start, value: text === "null" ? null : text === "true" });
      } else tokens.push({ kind: "word", text, offset: start });
      continue;
    }
    return reject(state, offset, ["IR value"]);
  }
  return tokens;
};
const syntax = (state: State, tokens: readonly Token[]): SyntaxValue | null => {
  const stack: Frame[] = [];
  let root: SyntaxValue | null = null;
  let index = 0;
  const accept = (value: SyntaxValue): void => {
    const parent = stack[stack.length - 1];
    if (parent === undefined) root = value;
    else if (parent.kind === "array") { parent.values.push(value); parent.phase = "separator"; }
    else { parent.fields.push({ name: parent.name, offset: parent.fieldOffset, value }); parent.phase = "separator"; }
  };
  while (index < tokens.length || stack.length !== 0) {
    const token = tokens[index];
    if (token === undefined) return reject(state, state.text.length, [")", "]"]);
    const frame = stack[stack.length - 1];
    if (frame !== undefined) {
      const close = frame.kind === "array" ? "]" : ")";
      if ((frame.phase === "first" || frame.phase === "separator") && token.text === close) {
        stack.pop(); index += 1;
        accept(frame.kind === "array" ? { kind: "array", offset: frame.offset, values: frame.values }
          : { kind: "record", offset: frame.offset, end: token.offset, label: frame.label, fields: frame.fields }); continue;
      }
      if (frame.phase === "separator") {
        if (token.text !== ",") return reject(state, token.offset, [",", close]);
        frame.phase = frame.kind === "array" ? "value" : "field"; index += 1; continue;
      }
      if (frame.kind === "record" && (frame.phase === "first" || frame.phase === "field")) {
        if (token.kind !== "word" && !(token.kind === "scalar" && typeof token.value === "string")) return reject(state, token.offset, ["field name"]);
        frame.name = token.kind === "scalar" ? String(token.value) : token.text;
        frame.fieldOffset = token.offset; frame.phase = "equals"; index += 1; continue;
      }
      if (frame.kind === "record" && frame.phase === "equals") {
        if (token.text !== "=") return reject(state, token.offset, ["="]);
        frame.phase = "value"; index += 1; continue;
      }
    } else if (root !== null) return reject(state, token.offset, ["end of document"]);
    if (token.kind === "scalar") { accept({ kind: "scalar", offset: token.offset, value: token.value }); index += 1; continue; }
    if (token.text === "[") { stack.push({ kind: "array", offset: token.offset, values: [], phase: "first" }); index += 1; continue; }
    if (token.kind === "word") {
      const next = tokens[index + 1];
      if (next?.text === "(") {
        stack.push({ kind: "record", offset: token.offset, label: token.text, fields: [], phase: "first", name: "", fieldOffset: token.offset });
        index += 2; continue;
      }
      const item = tokens[index + 2];
      if (next?.text === ":" && item?.kind === "scalar" && (typeof item.value === "number" || typeof item.value === "string")) {
        accept({ kind: "identity", offset: token.offset, prefix: token.text, value: item.value }); index += 3; continue;
      }
    }
    return reject(state, token.offset, ["IR value"]);
  }
  return root === null ? reject(state, state.text.length, ["record"]) : root;
};
const fields = (state: State, input: SyntaxValue | undefined, label: string, names: readonly string[]): readonly SyntaxValue[] | null => {
  if (input?.kind !== "record" || input.label !== label) return fail(state, input, [label]);
  for (let index = 0; index < Math.max(input.fields.length, names.length); index += 1) {
    const actual = input.fields[index];
    const expected = names[index];
    if (actual === undefined) return reject(state, input.end, expected === undefined ? [")"] : [expected]);
    if (actual.name !== expected) return reject(state, actual.offset, expected === undefined ? [")"] : [expected]);
  }
  return input.fields.map(field => field.value);
};
const scalarString: Decode<string> = (state, input) => input?.kind === "scalar" && typeof input.value === "string"
  ? { value: input.value } : fail(state, input, ["string"]);
const scalarNumber: Decode<number> = (state, input) => input?.kind === "scalar" && typeof input.value === "number"
  ? { value: input.value } : fail(state, input, ["number"]);
const scalarBigint: Decode<bigint> = (state, input) => input?.kind === "scalar" && typeof input.value === "bigint"
  ? { value: input.value } : fail(state, input, ["bigint"]);
const scalarBoolean: Decode<boolean> = (state, input) => input?.kind === "scalar" && typeof input.value === "boolean"
  ? { value: input.value } : fail(state, input, ["boolean"]);
const literal = <Value extends string | number>(state: State, input: SyntaxValue | undefined, values: readonly Value[]): Decoded<Value> | null => {
  if (input?.kind === "scalar") for (const value of values) if (value === input.value) return { value };
  return fail(state, input, values.map(value => typeof value === "string" ? JSON.stringify(value) : String(value)));
};
const nullable = <Value>(state: State, input: SyntaxValue | undefined, decode: Decode<Value>): Decoded<Value | null> | null =>
  input?.kind === "scalar" && input.value === null ? { value: null } : decode(state, input);
const sequence = <Value>(state: State, input: SyntaxValue | undefined, decode: Decode<Value>): Decoded<readonly Value[]> | null => {
  if (input?.kind !== "array") return fail(state, input, ["array"]);
  const values: Value[] = [];
  for (const item of input.values) { const decoded = decode(state, item); if (decoded === null) return null; values.push(decoded.value); }
  return { value: Object.freeze(values) };
};
const nonempty = <Value>(state: State, input: SyntaxValue | undefined, decode: Decode<Value>): Decoded<readonly [Value, ...Value[]]> | null => {
  if (input?.kind !== "array" || input.values.length === 0) return fail(state, input, ["nonempty array"]);
  const first = decode(state, input.values[0]);
  if (first === null) return null;
  const rest: Value[] = [];
  for (let index = 1; index < input.values.length; index += 1) {
    const item = decode(state, input.values[index]); if (item === null) return null; rest.push(item.value);
  }
  const result: readonly [Value, ...Value[]] = [first.value, ...rest];
  return { value: Object.freeze(result) };
};

const numeric = <Identity extends number>(state: State, input: SyntaxValue | undefined, prefix: string,
  validate: (value: number) => value is Identity): Decoded<Identity> | null =>
  input?.kind === "identity" && input.prefix === prefix && typeof input.value === "number" && validate(input.value)
    ? { value: input.value } : fail(state, input, [prefix + ":integer"]);
const block: Decode<BlockId> = (state, input) => numeric(state, input, "b", (value): value is BlockId => Number.isInteger(value));
const bound: Decode<BoundProducerId> = (state, input) => numeric(state, input, "bound", (value): value is BoundProducerId => Number.isInteger(value));
const layout: Decode<LayoutId> = (state, input) => numeric(state, input, "layout", (value): value is LayoutId => Number.isInteger(value));
const local: Decode<LocalId> = (state, input) => numeric(state, input, "l", (value): value is LocalId => Number.isInteger(value));
const field: Decode<MemoryFieldId> = (state, input) => numeric(state, input, "field", (value): value is MemoryFieldId => Number.isInteger(value));
const node: Decode<NodeId> = (state, input) => numeric(state, input, "n", (value): value is NodeId => Number.isInteger(value));
const boundary: Decode<OpenBoundaryId> = (state, input) => numeric(state, input, "boundary", (value): value is OpenBoundaryId => Number.isInteger(value));
const originsIdentity: Decode<OriginsId> = (state, input) => numeric(state, input, "origins", (value): value is OriginsId => Number.isInteger(value));
const place: Decode<PlaceId> = (state, input) => numeric(state, input, "p", (value): value is PlaceId => Number.isInteger(value));
const producerIdentity: Decode<ProducerId> = (state, input) => numeric(state, input, "producer", (value): value is ProducerId => Number.isInteger(value));
const path: Decode<ProjectionPathId> = (state, input) => numeric(state, input, "path", (value): value is ProjectionPathId => Number.isInteger(value));
const signature: Decode<SigId> = (state, input) => numeric(state, input, "sig", (value): value is SigId => Number.isInteger(value));
const typeIdentity: Decode<TyId> = (state, input) => numeric(state, input, "t", (value): value is TyId => Number.isInteger(value));
const contextIdentity: Decode<ValueContextId> = (state, input) => numeric(state, input, "context", (value): value is ValueContextId => Number.isInteger(value));
const definition: Decode<DefId> = (state, input) => {
  if (input?.kind !== "identity" || input.prefix !== "def" || typeof input.value !== "string") return fail(state, input, ["def:string"]);
  const decoded = decodeDefId(input.value);
  return decoded.kind === "decoded" ? { value: encodeDefId(decoded.value) } : fail(state, input, ["canonical DefId"]);
};
const body: Decode<BodyId> = (state, input) => {
  if (input?.kind !== "identity" || input.prefix !== "body" || typeof input.value !== "string") return fail(state, input, ["body:string"]);
  const decoded = decodeBodyId(input.value);
  return decoded.kind === "decoded" ? { value: encodeBodyId(decoded.value) } : fail(state, input, ["canonical BodyId"]);
};
const component: Decode<ComponentId> = (state, input) => {
  if (input?.kind !== "identity" || input.prefix !== "component" || typeof input.value !== "string") return fail(state, input, ["component:string"]);
  const decoded = decodeComponentId(input.value);
  return decoded.kind === "decoded" ? { value: encodeComponentId(decoded.value) } : fail(state, input, ["canonical ComponentId"]);
};
const label = <Name extends string>(state: State, input: SyntaxValue | undefined, names: readonly Name[]): Decoded<Name> | null => {
  if (input?.kind === "record") for (const name of names) if (input.label === name) return { value: name };
  return fail(state, input, names);
};

const nodeRef: Decode<NodeRef> = (state, input) => {
  const values = fields(state, input, "NodeRef", ["body","node"]); if (values === null) return null;
  const bodyValue = body(state, values[0]); const nodeValue = node(state, values[1]);
  if (bodyValue === null || nodeValue === null) return null;
  return { value: { body: bodyValue.value, node: nodeValue.value } };
};
const localRef: Decode<LocalRef> = (state, input) => {
  const values = fields(state, input, "LocalRef", ["body","local"]); if (values === null) return null;
  const bodyValue = body(state, values[0]); const localValue = local(state, values[1]);
  if (bodyValue === null || localValue === null) return null;
  return { value: { body: bodyValue.value, local: localValue.value } };
};
const parameterIdentity: Decode<TypeParameterIdentity> = (state, input) => {
  const values = fields(state, input, "TypeParameterIdentity", ["owner","index"]); if (values === null) return null;
  const ownerValue = definition(state, values[0]); const indexValue = scalarNumber(state, values[1]);
  if (ownerValue === null || indexValue === null) return null;
  return { value: { owner: ownerValue.value, index: indexValue.value } };
};
const bindings: Decode<BindingVector> = (state, input) => {
  const values = fields(state, input, "BindingVector", ["classBindings","methodBindings","capturedBindings","selfBindings"]); if (values === null) return null;
  const classBindingsValue = sequence(state, values[0], typeBinding); const methodBindingsValue = sequence(state, values[1], typeBinding);
  const capturedBindingsValue = sequence(state, values[2], typeBinding); const selfBindingsValue = sequence(state, values[3], selfBinding);
  if (classBindingsValue === null || methodBindingsValue === null || capturedBindingsValue === null || selfBindingsValue === null) return null;
  return { value: { classBindings: classBindingsValue.value, methodBindings: methodBindingsValue.value, capturedBindings: capturedBindingsValue.value, selfBindings: selfBindingsValue.value } };
};
const bodyInstance: Decode<BodyInstance> = (state, input) => {
  const values = fields(state, input, "BodyInstance", ["body","bindings"]); if (values === null) return null;
  const bodyValue = body(state, values[0]); const bindingsValue = artifact(state, values[1]);
  if (bodyValue === null || bindingsValue === null) return null;
  return { value: { body: bodyValue.value, bindings: bindingsValue.value } };
};
const rational: Decode<ExactRational> = (state, input) => {
  const values = fields(state, input, "ExactRational", ["numerator","denominator","negativeZero"]); if (values === null) return null;
  const numeratorValue = scalarBigint(state, values[0]); const denominatorValue = scalarBigint(state, values[1]);
  const negativeZeroValue = scalarBoolean(state, values[2]);
  if (numeratorValue === null || denominatorValue === null || negativeZeroValue === null) return null;
  return { value: { numerator: numeratorValue.value, denominator: denominatorValue.value, negativeZero: negativeZeroValue.value } };
};
const endpoint: Decode<HirCallableEndpoint> = (state, input) => {
  const values = fields(state, input, "HirCallableEndpoint", ["declaration","role","signature","body"]); if (values === null) return null;
  const declarationValue = definition(state, values[0]); const roleValue = literal(state, values[1], ["advertised","api-signature","api-body"]);
  const signatureValue = signature(state, values[2]); const bodyValue = nullable(state, values[3], body);
  if (declarationValue === null || roleValue === null || signatureValue === null || bodyValue === null) return null;
  return { value: { declaration: declarationValue.value, role: roleValue.value, signature: signatureValue.value, body: bodyValue.value } };
};
const completion: Decode<CompletionEndpoint> = (state, input) => {
  const values = fields(state, input, "CompletionEndpoint", ["signature","completion","yielded","sent"]); if (values === null) return null;
  const signatureValue = signature(state, values[0]); const completionValue = typeIdentity(state, values[1]);
  const yieldedValue = nullable(state, values[2], typeIdentity); const sentValue = nullable(state, values[3], typeIdentity);
  if (signatureValue === null || completionValue === null || yieldedValue === null || sentValue === null) return null;
  return { value: { signature: signatureValue.value, completion: completionValue.value, yielded: yieldedValue.value, sent: sentValue.value } };
};
const application: Decode<ApplicationDecision> = (state, input) => {
  const values = fields(state, input, "ApplicationDecision", ["candidate","advertised","api","bindings","implementationBindings","parameters","completion","result"]); if (values === null) return null;
  const candidateValue = scalarNumber(state, values[0]); const advertisedValue = endpoint(state, values[1]);
  const apiValue = endpoint(state, values[2]); const bindingsValue = bindings(state, values[3]);
  const implementationBindingsValue = nullable(state, values[4], bindings); const parametersValue = sequence(state, values[5], parameterMapping);
  const completionValue = completion(state, values[6]); const resultValue = typeIdentity(state, values[7]);
  if (candidateValue === null || advertisedValue === null || apiValue === null || bindingsValue === null || implementationBindingsValue === null || parametersValue === null || completionValue === null || resultValue === null) return null;
  return { value: { candidate: candidateValue.value, advertised: advertisedValue.value, api: apiValue.value, bindings: bindingsValue.value, implementationBindings: implementationBindingsValue.value, parameters: parametersValue.value, completion: completionValue.value, result: resultValue.value } };
};
const memberDecision: Decode<MemberDecision> = (state, input) => {
  const values = fields(state, input, "MemberDecision", ["key","origins","selectedDeclarations","primary","read","write","getter","setter","bindings"]); if (values === null) return null;
  const keyValue = memberKey(state, values[0]); const originsValue = sequence(state, values[1], memberOrigin);
  const selectedDeclarationsValue = sequence(state, values[2], definition); const primaryValue = nullable(state, values[3], definition);
  const readValue = nullable(state, values[4], typeIdentity); const writeValue = nullable(state, values[5], typeIdentity);
  const getterValue = nullable(state, values[6], endpoint); const setterValue = nullable(state, values[7], endpoint);
  const bindingsValue = bindings(state, values[8]);
  if (keyValue === null || originsValue === null || selectedDeclarationsValue === null || primaryValue === null || readValue === null || writeValue === null || getterValue === null || setterValue === null || bindingsValue === null) return null;
  return { value: { key: keyValue.value, origins: originsValue.value, selectedDeclarations: selectedDeclarationsValue.value, primary: primaryValue.value, read: readValue.value, write: writeValue.value, getter: getterValue.value, setter: setterValue.value, bindings: bindingsValue.value } };
};
const resolved: Decode<ResolvedCallee> = (state, input) => {
  const values = fields(state, input, "ResolvedCallee", ["decision","activation","captures"]); if (values === null) return null;
  const decisionValue = application(state, values[0]); const activationValue = nullable(state, values[1], bodyInstance);
  const capturesValue = sequence(state, values[2], localRef);
  if (decisionValue === null || activationValue === null || capturesValue === null) return null;
  return { value: { decision: decisionValue.value, activation: activationValue.value, captures: capturesValue.value } };
};
const memberSelection: Decode<MemberSelection> = (state, input) => {
  const values = fields(state, input, "MemberSelection", ["decision","getter","setter"]); if (values === null) return null;
  const decisionValue = memberDecision(state, values[0]); const getterValue = nullable(state, values[1], resolved);
  const setterValue = nullable(state, values[2], resolved);
  if (decisionValue === null || getterValue === null || setterValue === null) return null;
  return { value: { decision: decisionValue.value, getter: getterValue.value, setter: setterValue.value } };
};
const libraryModule: Decode<LibraryModuleIdentity> = (state, input) => {
  const values = fields(state, input, "LibraryModuleIdentity", ["providerId","providerVersion","packageName","moduleSpecifier","providerModuleId"]); if (values === null) return null;
  const providerIdValue = scalarString(state, values[0]); const providerVersionValue = scalarString(state, values[1]);
  const packageNameValue = nullable(state, values[2], scalarString); const moduleSpecifierValue = scalarString(state, values[3]);
  const providerModuleIdValue = scalarString(state, values[4]);
  if (providerIdValue === null || providerVersionValue === null || packageNameValue === null || moduleSpecifierValue === null || providerModuleIdValue === null) return null;
  return { value: { providerId: providerIdValue.value, providerVersion: providerVersionValue.value, packageName: packageNameValue.value, moduleSpecifier: moduleSpecifierValue.value, providerModuleId: providerModuleIdValue.value } };
};
const libraryExport: Decode<LibraryExportIdentity> = (state, input) => {
  const values = fields(state, input, "LibraryExportIdentity", ["module","exportId","memberId","signatureId"]); if (values === null) return null;
  const moduleValue = libraryModule(state, values[0]); const exportIdValue = scalarString(state, values[1]);
  const memberIdValue = nullable(state, values[2], scalarString); const signatureIdValue = nullable(state, values[3], scalarString);
  if (moduleValue === null || exportIdValue === null || memberIdValue === null || signatureIdValue === null) return null;
  return { value: { module: moduleValue.value, exportId: exportIdValue.value, memberId: memberIdValue.value, signatureId: signatureIdValue.value } };
};
const producerRef: Decode<ProducerRef> = (state, input) => {
  const values = fields(state, input, "ProducerRef", ["owner","producer"]); if (values === null) return null;
  const ownerValue = owner(state, values[0]); const producerValue = producerIdentity(state, values[1]);
  if (ownerValue === null || producerValue === null) return null;
  return { value: { owner: ownerValue.value, producer: producerValue.value } };
};
const boundaryRef: Decode<OpenBoundaryRef> = (state, input) => {
  const values = fields(state, input, "OpenBoundaryRef", ["owner","boundary"]); if (values === null) return null;
  const ownerValue = owner(state, values[0]); const boundaryValue = boundary(state, values[1]);
  if (ownerValue === null || boundaryValue === null) return null;
  return { value: { owner: ownerValue.value, boundary: boundaryValue.value } };
};
const projectionPath: Decode<ProjectionPath> = (state, input) => {
  const values = fields(state, input, "ProjectionPath", ["id","parent","projection"]); if (values === null) return null;
  const idValue = path(state, values[0]); const parentValue = nullable(state, values[1], path);
  const projectionValue = projection(state, values[2]);
  if (idValue === null || parentValue === null || projectionValue === null) return null;
  return { value: { id: idValue.value, parent: parentValue.value, projection: projectionValue.value } };
};
const captureLocation: Decode<CaptureLocation> = (state, input) => {
  const values = fields(state, input, "CaptureLocation", ["index","location"]); if (values === null) return null;
  const indexValue = scalarNumber(state, values[0]); const locationValue = bound(state, values[1]);
  if (indexValue === null || locationValue === null) return null;
  return { value: { index: indexValue.value, location: locationValue.value } };
};
const valueContext: Decode<ValueContext> = (state, input) => {
  const values = fields(state, input, "ValueContext", ["id","receiver","arguments","captures"]); if (values === null) return null;
  const idValue = contextIdentity(state, values[0]); const receiverValue = nullable(state, values[1], originsIdentity);
  const argumentsValue = sequence(state, values[2], originsIdentity); const capturesValue = sequence(state, values[3], captureLocation);
  if (idValue === null || receiverValue === null || argumentsValue === null || capturesValue === null) return null;
  return { value: { id: idValue.value, receiver: receiverValue.value, arguments: argumentsValue.value, captures: capturesValue.value } };
};
const boundProducer: Decode<BoundProducer> = (state, input) => {
  const values = fields(state, input, "BoundProducer", ["id","producer","bindings","context"]); if (values === null) return null;
  const idValue = bound(state, values[0]); const producerValue = producerIdentity(state, values[1]);
  const bindingsValue = bindings(state, values[2]); const contextValue = contextIdentity(state, values[3]);
  if (idValue === null || producerValue === null || bindingsValue === null || contextValue === null) return null;
  return { value: { id: idValue.value, producer: producerValue.value, bindings: bindingsValue.value, context: contextValue.value } };
};
const openBoundary: Decode<OpenBoundary> = (state, input) => {
  const kind = label(state, input, ["external-input","external-write","opaque-write","opaque-result","unclassified-exposure","opaque-invocation","unresolved-transport"]); if (kind === null) return null;
  const values = fields(state, input, kind.value, ["id","at","subject","owner","bindings","context","detail"]); if (values === null) return null;
  const idValue = boundary(state, values[0]); const atValue = site(state, values[1]);
  const subjectValue = producerIdentity(state, values[2]); const ownerValue = nullable(state, values[3], producerIdentity);
  const bindingsValue = bindings(state, values[4]); const contextValue = contextIdentity(state, values[5]);
  const detailValue = scalarString(state, values[6]);
  if (idValue === null || atValue === null || subjectValue === null || ownerValue === null || bindingsValue === null || contextValue === null || detailValue === null) return null;
  return { value: { kind: kind.value, id: idValue.value, at: atValue.value, subject: subjectValue.value, owner: ownerValue.value, bindings: bindingsValue.value, context: contextValue.value, detail: detailValue.value } };
};
const arena: Decode<RelationalArena> = (state, input) => {
  const values = fields(state, input, "RelationalArena", ["projections","producers","contexts","boundProducers","origins","boundaries"]); if (values === null) return null;
  const projectionsValue = sequence(state, values[0], projectionPath); const producersValue = sequence(state, values[1], producer);
  const contextsValue = sequence(state, values[2], valueContext); const boundProducersValue = sequence(state, values[3], boundProducer);
  const originsValue = sequence(state, values[4], origins); const boundariesValue = sequence(state, values[5], openBoundary);
  if (projectionsValue === null || producersValue === null || contextsValue === null || boundProducersValue === null || originsValue === null || boundariesValue === null) return null;
  return { value: { projections: projectionsValue.value, producers: producersValue.value, contexts: contextsValue.value, boundProducers: boundProducersValue.value, origins: originsValue.value, boundaries: boundariesValue.value } };
};
const mirPoint: Decode<MirPoint> = (state, input) => {
  const values = fields(state, input, "MirPoint", ["block","statement"]); if (values === null) return null;
  const blockValue = block(state, values[0]); const statementValue = nullable(state, values[1], scalarNumber);
  if (blockValue === null || statementValue === null) return null;
  return { value: { block: blockValue.value, statement: statementValue.value } };
};
const storeLiveness: Decode<StoreLiveness> = (state, input) => {
  const values = fields(state, input, "StoreLiveness", ["node","point","observed"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const pointValue = mirPoint(state, values[1]);
  const observedValue = scalarBoolean(state, values[2]);
  if (nodeValue === null || pointValue === null || observedValue === null) return null;
  return { value: { node: nodeValue.value, point: pointValue.value, observed: observedValue.value } };
};
const liveSegment: Decode<LiveSegment> = (state, input) => {
  const values = fields(state, input, "LiveSegment", ["block","first","last"]); if (values === null) return null;
  const blockValue = block(state, values[0]); const firstValue = scalarNumber(state, values[1]);
  const lastValue = scalarNumber(state, values[2]);
  if (blockValue === null || firstValue === null || lastValue === null) return null;
  return { value: { block: blockValue.value, first: firstValue.value, last: lastValue.value } };
};
const localLiveRange: Decode<LocalLiveRange> = (state, input) => {
  const values = fields(state, input, "LocalLiveRange", ["local","segments"]); if (values === null) return null;
  const localValue = local(state, values[0]); const segmentsValue = sequence(state, values[1], liveSegment);
  if (localValue === null || segmentsValue === null) return null;
  return { value: { local: localValue.value, segments: segmentsValue.value } };
};
const bindingStorage: Decode<BindingStorageFact> = (state, input) => {
  const values = fields(state, input, "BindingStorageFact", ["local","scope","captured"]); if (values === null) return null;
  const localValue = local(state, values[0]); const scopeValue = literal(state, values[1], ["body","shared"]);
  const capturedValue = scalarBoolean(state, values[2]);
  if (localValue === null || scopeValue === null || capturedValue === null) return null;
  return { value: { local: localValue.value, scope: scopeValue.value, captured: capturedValue.value } };
};
const captureFact: Decode<CaptureFact> = (state, input) => {
  const values = fields(state, input, "CaptureFact", ["local","reads","writes"]); if (values === null) return null;
  const localValue = localRef(state, values[0]); const readsValue = scalarBoolean(state, values[1]);
  const writesValue = scalarBoolean(state, values[2]);
  if (localValue === null || readsValue === null || writesValue === null) return null;
  return { value: { local: localValue.value, reads: readsValue.value, writes: writesValue.value } };
};
const liveness: Decode<LivenessFacts> = (state, input) => {
  const values = fields(state, input, "LivenessFacts", ["stores","locals","bindings","captures"]); if (values === null) return null;
  const storesValue = sequence(state, values[0], storeLiveness); const localsValue = sequence(state, values[1], localLiveRange);
  const bindingsValue = sequence(state, values[2], bindingStorage); const capturesValue = sequence(state, values[3], captureFact);
  if (storesValue === null || localsValue === null || bindingsValue === null || capturesValue === null) return null;
  return { value: { stores: storesValue.value, locals: localsValue.value, bindings: bindingsValue.value, captures: capturesValue.value } };
};
const initializationFact: Decode<InitializationFact> = (state, input) => {
  const values = fields(state, input, "InitializationFact", ["node","place","assigned"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const placeValue = place(state, values[1]);
  const assignedValue = scalarBoolean(state, values[2]);
  if (nodeValue === null || placeValue === null || assignedValue === null) return null;
  return { value: { node: nodeValue.value, place: placeValue.value, assigned: assignedValue.value } };
};
const initialization: Decode<InitializationFacts> = (state, input) => {
  const values = fields(state, input, "InitializationFacts", ["reads"]); if (values === null) return null;
  const readsValue = sequence(state, values[0], initializationFact);
  if (readsValue === null) return null;
  return { value: { reads: readsValue.value } };
};
const refinementInvalidation: Decode<RefinementInvalidation> = (state, input) => {
  const kind = label(state, input, ["write","call"]); if (kind === null) return null;
  const values = fields(state, input, kind.value, ["at"]); if (values === null) return null;
  const atValue = nodeRef(state, values[0]);
  if (atValue === null) return null;
  return { value: { kind: kind.value, at: atValue.value } };
};
const integerRange: Decode<IntegerRange> = (state, input) => {
  const values = fields(state, input, "IntegerRange", ["minimum","maximum"]); if (values === null) return null;
  const minimumValue = scalarBigint(state, values[0]); const maximumValue = scalarBigint(state, values[1]);
  if (minimumValue === null || maximumValue === null) return null;
  return { value: { minimum: minimumValue.value, maximum: maximumValue.value } };
};
const integerFact: Decode<IntegerFact> = (state, input) => {
  const values = fields(state, input, "IntegerFact", ["node","range","nonnegative"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const rangeValue = nullable(state, values[1], integerRange);
  const nonnegativeValue = scalarBoolean(state, values[2]);
  if (nodeValue === null || rangeValue === null || nonnegativeValue === null) return null;
  return { value: { node: nodeValue.value, range: rangeValue.value, nonnegative: nonnegativeValue.value } };
};
const countedLoop: Decode<CountedLoopFact> = (state, input) => {
  const values = fields(state, input, "CountedLoopFact", ["statement","counterDeclaration","start","bound","body","direction","comparison","step"]); if (values === null) return null;
  const statementValue = node(state, values[0]); const counterDeclarationValue = node(state, values[1]);
  const startValue = node(state, values[2]); const boundValue = node(state, values[3]);
  const bodyValue = node(state, values[4]); const directionValue = literal(state, values[5], ["ascending"]);
  const comparisonValue = literal(state, values[6], ["exclusive-upper-bound"]); const stepValue = literal(state, values[7], [1]);
  if (statementValue === null || counterDeclarationValue === null || startValue === null || boundValue === null || bodyValue === null || directionValue === null || comparisonValue === null || stepValue === null) return null;
  return { value: { statement: statementValue.value, counterDeclaration: counterDeclarationValue.value, start: startValue.value, bound: boundValue.value, body: bodyValue.value, direction: directionValue.value, comparison: comparisonValue.value, step: stepValue.value } };
};
const refinements: Decode<RefinementFacts> = (state, input) => {
  const values = fields(state, input, "RefinementFacts", ["refinements","integers","countedLoops"]); if (values === null) return null;
  const refinementsValue = sequence(state, values[0], refinementFact); const integersValue = sequence(state, values[1], integerFact);
  const countedLoopsValue = sequence(state, values[2], countedLoop);
  if (refinementsValue === null || integersValue === null || countedLoopsValue === null) return null;
  return { value: { refinements: refinementsValue.value, integers: integersValue.value, countedLoops: countedLoopsValue.value } };
};
const readOrigins: Decode<ReadOriginsFact> = (state, input) => {
  const values = fields(state, input, "ReadOriginsFact", ["node","place","origins"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const placeValue = place(state, values[1]);
  const originsValue = originsIdentity(state, values[2]);
  if (nodeValue === null || placeValue === null || originsValue === null) return null;
  return { value: { node: nodeValue.value, place: placeValue.value, origins: originsValue.value } };
};
const pointOrigins: Decode<PointPlaceOrigins> = (state, input) => {
  const values = fields(state, input, "PointPlaceOrigins", ["point","place","origins"]); if (values === null) return null;
  const pointValue = mirPoint(state, values[0]); const placeValue = place(state, values[1]);
  const originsValue = originsIdentity(state, values[2]);
  if (pointValue === null || placeValue === null || originsValue === null) return null;
  return { value: { point: pointValue.value, place: placeValue.value, origins: originsValue.value } };
};
const subjectOrigins: Decode<SubjectOriginsFact> = (state, input) => {
  const values = fields(state, input, "SubjectOriginsFact", ["node","role","path","origins"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const roleValue = literal(state, values[1], ["input","value","member","return","receiver"]);
  const pathValue = nullable(state, values[2], path); const originsValue = originsIdentity(state, values[3]);
  if (nodeValue === null || roleValue === null || pathValue === null || originsValue === null) return null;
  return { value: { node: nodeValue.value, role: roleValue.value, path: pathValue.value, origins: originsValue.value } };
};
const writtenReason: Decode<WrittenOriginsReason> = (state, input) => {
  const kind = label(state, input, ["value-source-unproven"]); if (kind === null) return null;
  const values = fields(state, input, kind.value, ["detail"]); if (values === null) return null;
  const detailValue = scalarString(state, values[0]);
  if (detailValue === null) return null;
  return { value: { kind: kind.value, detail: detailValue.value } };
};
const writtenOrigins: Decode<WrittenOrigins> = (state, input) => {
  const values = fields(state, input, "WrittenOrigins", ["source","origins","reason"]); if (values === null) return null;
  const sourceValue = nullable(state, values[0], nodeRef); const originsValue = originsIdentity(state, values[1]);
  const reasonValue = nullable(state, values[2], writtenReason);
  if (sourceValue === null || originsValue === null || reasonValue === null) return null;
  return { value: { source: sourceValue.value, origins: originsValue.value, reason: reasonValue.value } };
};
const writeFact: Decode<WriteFact> = (state, input) => {
  const values = fields(state, input, "WriteFact", ["node","operation","destination","targets","owner","values","boundaries"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const operationValue = literal(state, values[1], ["initialization","mutation"]);
  const destinationValue = literal(state, values[2], ["binding","member","element","pointer"]); const targetsValue = sequence(state, values[3], bound);
  const ownerValue = nullable(state, values[4], bound); const valuesValue = sequence(state, values[5], writtenOrigins);
  const boundariesValue = sequence(state, values[6], boundary);
  if (nodeValue === null || operationValue === null || destinationValue === null || targetsValue === null || ownerValue === null || valuesValue === null || boundariesValue === null) return null;
  return { value: { node: nodeValue.value, operation: operationValue.value, destination: destinationValue.value, targets: targetsValue.value, owner: ownerValue.value, values: valuesValue.value, boundaries: boundariesValue.value } };
};
const escapeFact: Decode<EscapeFact> = (state, input) => {
  const values = fields(state, input, "EscapeFact", ["node","producer","target"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const producerValue = producerIdentity(state, values[1]);
  const targetValue = escapeTarget(state, values[2]);
  if (nodeValue === null || producerValue === null || targetValue === null) return null;
  return { value: { node: nodeValue.value, producer: producerValue.value, target: targetValue.value } };
};
const argumentTransport: Decode<ArgumentTransport> = (state, input) => {
  const values = fields(state, input, "ArgumentTransport", ["authoredIndex","parameter","parameterIndex","effectiveIndex","repeated","passing","actual","formal","projection"]); if (values === null) return null;
  const authoredIndexValue = nullable(state, values[0], scalarNumber); const parameterValue = definition(state, values[1]);
  const parameterIndexValue = scalarNumber(state, values[2]); const effectiveIndexValue = scalarNumber(state, values[3]);
  const repeatedValue = scalarBoolean(state, values[4]); const passingValue = literal(state, values[5], ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]);
  const actualValue = originsIdentity(state, values[6]); const formalValue = producerRef(state, values[7]);
  const projectionValue = nullable(state, values[8], path);
  if (authoredIndexValue === null || parameterValue === null || parameterIndexValue === null || effectiveIndexValue === null || repeatedValue === null || passingValue === null || actualValue === null || formalValue === null || projectionValue === null) return null;
  return { value: { authoredIndex: authoredIndexValue.value, parameter: parameterValue.value, parameterIndex: parameterIndexValue.value, effectiveIndex: effectiveIndexValue.value, repeated: repeatedValue.value, passing: passingValue.value, actual: actualValue.value, formal: formalValue.value, projection: projectionValue.value } };
};
const summaryKey: Decode<SummaryKey> = (state, input) => {
  const values = fields(state, input, "SummaryKey", ["definition","bindings"]); if (values === null) return null;
  const definitionValue = definition(state, values[0]); const bindingsValue = artifact(state, values[1]);
  if (definitionValue === null || bindingsValue === null) return null;
  return { value: { definition: definitionValue.value, bindings: bindingsValue.value } };
};
const invocationAlternative: Decode<InvocationAlternative> = (state, input) => {
  const values = fields(state, input, "InvocationAlternative", ["resolution","context","arguments","result","thrown","summary"]); if (values === null) return null;
  const resolutionValue = resolved(state, values[0]); const contextValue = contextIdentity(state, values[1]);
  const argumentsValue = sequence(state, values[2], argumentTransport); const resultValue = originsIdentity(state, values[3]);
  const thrownValue = originsIdentity(state, values[4]); const summaryValue = summaryKey(state, values[5]);
  if (resolutionValue === null || contextValue === null || argumentsValue === null || resultValue === null || thrownValue === null || summaryValue === null) return null;
  return { value: { resolution: resolutionValue.value, context: contextValue.value, arguments: argumentsValue.value, result: resultValue.value, thrown: thrownValue.value, summary: summaryValue.value } };
};
const invocationFact: Decode<InvocationFact> = (state, input) => {
  const kind = label(state, input, ["call","construct","getter","setter","native-callback"]); if (kind === null) return null;
  const values = fields(state, input, kind.value, ["node","alternatives","boundaries"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const alternativesValue = sequence(state, values[1], invocationAlternative);
  const boundariesValue = sequence(state, values[2], boundary);
  if (nodeValue === null || alternativesValue === null || boundariesValue === null) return null;
  return { value: { kind: kind.value, node: nodeValue.value, alternatives: alternativesValue.value, boundaries: boundariesValue.value } };
};
const callbackEntry: Decode<CallbackEntry> = (state, input) => {
  const values = fields(state, input, "CallbackEntry", ["node","argument","timing","rejection","inputs"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const argumentValue = argumentTransport(state, values[1]);
  const timingValue = literal(state, values[2], ["synchronous","deferred","unknown"]); const rejectionValue = nullable(state, values[3], scalarNumber);
  const inputsValue = sequence(state, values[4], callbackInput);
  if (nodeValue === null || argumentValue === null || timingValue === null || rejectionValue === null || inputsValue === null) return null;
  return { value: { node: nodeValue.value, argument: argumentValue.value, timing: timingValue.value, rejection: rejectionValue.value, inputs: inputsValue.value } };
};
const activation: Decode<BoundActivation> = (state, input) => {
  const values = fields(state, input, "BoundActivation", ["node","definition","context","caller","entry"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const definitionValue = definition(state, values[1]);
  const contextValue = contextIdentity(state, values[2]); const callerValue = nullable(state, values[3], contextIdentity);
  const entryValue = nullable(state, values[4], argumentTransport);
  if (nodeValue === null || definitionValue === null || contextValue === null || callerValue === null || entryValue === null) return null;
  return { value: { node: nodeValue.value, definition: definitionValue.value, context: contextValue.value, caller: callerValue.value, entry: entryValue.value } };
};
const frontier: Decode<ValueFrontier> = (state, input) => {
  const kind = label(state, input, ["boundary","origin"]); if (kind === null) return null;
  const values = fields(state, input, kind.value, ["node","subject","context"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const subjectValue = producerIdentity(state, values[1]);
  const contextValue = contextIdentity(state, values[2]);
  if (nodeValue === null || subjectValue === null || contextValue === null) return null;
  return { value: { kind: kind.value, node: nodeValue.value, subject: subjectValue.value, context: contextValue.value } };
};
const instanceRegion: Decode<InstanceRegion> = (state, input) => {
  const values = fields(state, input, "InstanceRegion", ["owner","node","context"]); if (values === null) return null;
  const ownerValue = definition(state, values[0]); const nodeValue = nodeRef(state, values[1]);
  const contextValue = contextIdentity(state, values[2]);
  if (ownerValue === null || nodeValue === null || contextValue === null) return null;
  return { value: { owner: ownerValue.value, node: nodeValue.value, context: contextValue.value } };
};
const construction: Decode<ConstructionAlternative> = (state, input) => {
  const values = fields(state, input, "ConstructionAlternative", ["node","root","allocation","implementation","body","regions"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const rootValue = nodeRef(state, values[1]);
  const allocationValue = nodeRef(state, values[2]); const implementationValue = nullable(state, values[3], definition);
  const bodyValue = nullable(state, values[4], bodyInstance); const regionsValue = sequence(state, values[5], instanceRegion);
  if (nodeValue === null || rootValue === null || allocationValue === null || implementationValue === null || bodyValue === null || regionsValue === null) return null;
  return { value: { node: nodeValue.value, root: rootValue.value, allocation: allocationValue.value, implementation: implementationValue.value, body: bodyValue.value, regions: regionsValue.value } };
};
const originFacts: Decode<OriginFacts> = (state, input) => {
  const values = fields(state, input, "OriginFacts", ["points","reads","subjects","writes","escapes","invocations","callbacks","activations","frontiers","constructions","instanceRegions"]); if (values === null) return null;
  const pointsValue = sequence(state, values[0], pointOrigins); const readsValue = sequence(state, values[1], readOrigins);
  const subjectsValue = sequence(state, values[2], subjectOrigins); const writesValue = sequence(state, values[3], writeFact);
  const escapesValue = sequence(state, values[4], escapeFact); const invocationsValue = sequence(state, values[5], invocationFact);
  const callbacksValue = sequence(state, values[6], callbackEntry); const activationsValue = sequence(state, values[7], activation);
  const frontiersValue = sequence(state, values[8], frontier); const constructionsValue = sequence(state, values[9], construction);
  const instanceRegionsValue = sequence(state, values[10], instanceRegion);
  if (pointsValue === null || readsValue === null || subjectsValue === null || writesValue === null || escapesValue === null || invocationsValue === null || callbacksValue === null || activationsValue === null || frontiersValue === null || constructionsValue === null || instanceRegionsValue === null) return null;
  return { value: { points: pointsValue.value, reads: readsValue.value, subjects: subjectsValue.value, writes: writesValue.value, escapes: escapesValue.value, invocations: invocationsValue.value, callbacks: callbacksValue.value, activations: activationsValue.value, frontiers: frontiersValue.value, constructions: constructionsValue.value, instanceRegions: instanceRegionsValue.value } };
};
const retention: Decode<RetentionFact> = (state, input) => {
  const values = fields(state, input, "RetentionFact", ["source","into"]); if (values === null) return null;
  const sourceValue = producerIdentity(state, values[0]); const intoValue = escapeTarget(state, values[1]);
  if (sourceValue === null || intoValue === null) return null;
  return { value: { source: sourceValue.value, into: intoValue.value } };
};
const suspensionValue: Decode<SuspensionValue> = (state, input) => {
  const values = fields(state, input, "SuspensionValue", ["place","origins","retention","continuations"]); if (values === null) return null;
  const placeValue = place(state, values[0]); const originsValue = originsIdentity(state, values[1]);
  const retentionValue = sequence(state, values[2], retention); const continuationsValue = sequence(state, values[3], (state, input) => literal(state, input, ["resume","return","unwind"]));
  if (placeValue === null || originsValue === null || retentionValue === null || continuationsValue === null) return null;
  return { value: { place: placeValue.value, origins: originsValue.value, retention: retentionValue.value, continuations: continuationsValue.value } };
};
const suspensionFact: Decode<SuspensionFact> = (state, input) => {
  const kind = label(state, input, ["await","yield","delegate"]); if (kind === null) return null;
  const values = fields(state, input, kind.value, ["node","values"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const valuesValue = sequence(state, values[1], suspensionValue);
  if (nodeValue === null || valuesValue === null) return null;
  return { value: { kind: kind.value, node: nodeValue.value, values: valuesValue.value } };
};
const suspension: Decode<SuspensionFacts> = (state, input) => {
  const values = fields(state, input, "SuspensionFacts", ["suspensions"]); if (values === null) return null;
  const suspensionsValue = sequence(state, values[0], suspensionFact);
  if (suspensionsValue === null) return null;
  return { value: { suspensions: suspensionsValue.value } };
};
const errorStorageFact: Decode<ErrorStorageFact> = (state, input) => {
  const values = fields(state, input, "ErrorStorageFact", ["node","origins","writes","retention","invalidations"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const originsValue = originsIdentity(state, values[1]);
  const writesValue = sequence(state, values[2], node); const retentionValue = sequence(state, values[3], retention);
  const invalidationsValue = sequence(state, values[4], errorInvalidation);
  if (nodeValue === null || originsValue === null || writesValue === null || retentionValue === null || invalidationsValue === null) return null;
  return { value: { node: nodeValue.value, origins: originsValue.value, writes: writesValue.value, retention: retentionValue.value, invalidations: invalidationsValue.value } };
};
const errorStorage: Decode<ErrorStorageFacts> = (state, input) => {
  const values = fields(state, input, "ErrorStorageFacts", ["errors"]); if (values === null) return null;
  const errorsValue = sequence(state, values[0], errorStorageFact);
  if (errorsValue === null) return null;
  return { value: { errors: errorsValue.value } };
};
const pointerBackingProducer: Decode<PointerBackingProducer> = (state, input) => {
  const values = fields(state, input, "PointerBackingProducer", ["producer","operation"]); if (values === null) return null;
  const producerValue = bound(state, values[0]); const operationValue = pointerOperation(state, values[1]);
  if (producerValue === null || operationValue === null) return null;
  return { value: { producer: producerValue.value, operation: operationValue.value } };
};
const pointerBackingFact: Decode<PointerBackingFact> = (state, input) => {
  const values = fields(state, input, "PointerBackingFact", ["node","returned","origins","producers"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const returnedValue = scalarBoolean(state, values[1]);
  const originsValue = originsIdentity(state, values[2]); const producersValue = sequence(state, values[3], pointerBackingProducer);
  if (nodeValue === null || returnedValue === null || originsValue === null || producersValue === null) return null;
  return { value: { node: nodeValue.value, returned: returnedValue.value, origins: originsValue.value, producers: producersValue.value } };
};
const pointerBacking: Decode<PointerBackingFacts> = (state, input) => {
  const values = fields(state, input, "PointerBackingFacts", ["pointers"]); if (values === null) return null;
  const pointersValue = sequence(state, values[0], pointerBackingFact);
  if (pointersValue === null) return null;
  return { value: { pointers: pointersValue.value } };
};
const metadataKey: Decode<MetadataKey> = (state, input) => {
  const values = fields(state, input, "MetadataKey", ["definition","bindings"]); if (values === null) return null;
  const definitionValue = definition(state, values[0]); const bindingsValue = artifact(state, values[1]);
  if (definitionValue === null || bindingsValue === null) return null;
  return { value: { definition: definitionValue.value, bindings: bindingsValue.value } };
};
const layoutRef: Decode<MetadataLayoutRef> = (state, input) => {
  const values = fields(state, input, "MetadataLayoutRef", ["metadata","layout"]); if (values === null) return null;
  const metadataValue = metadataKey(state, values[0]); const layoutValue = layout(state, values[1]);
  if (metadataValue === null || layoutValue === null) return null;
  return { value: { metadata: metadataValue.value, layout: layoutValue.value } };
};
const fieldRef: Decode<MetadataFieldRef> = (state, input) => {
  const values = fields(state, input, "MetadataFieldRef", ["metadata","field"]); if (values === null) return null;
  const metadataValue = metadataKey(state, values[0]); const fieldValue = field(state, values[1]);
  if (metadataValue === null || fieldValue === null) return null;
  return { value: { metadata: metadataValue.value, field: fieldValue.value } };
};
const memoryField: Decode<MemoryField> = (state, input) => {
  const values = fields(state, input, "MemoryField", ["id","occurrence","owner","selector","selection","member","primary","selectedDeclarations","value","layout","byteOffset","byteAlignment"]); if (values === null) return null;
  const idValue = field(state, values[0]); const occurrenceValue = sourceRef(state, values[1]);
  const ownerValue = typeIdentity(state, values[2]); const selectorValue = sourceRef(state, values[3]);
  const selectionValue = sourceRef(state, values[4]); const memberValue = memberSelection(state, values[5]);
  const primaryValue = nullable(state, values[6], definition); const selectedDeclarationsValue = sequence(state, values[7], definition);
  const valueValue = typeIdentity(state, values[8]); const layoutValue = layout(state, values[9]);
  const byteOffsetValue = scalarBigint(state, values[10]); const byteAlignmentValue = scalarBigint(state, values[11]);
  if (idValue === null || occurrenceValue === null || ownerValue === null || selectorValue === null || selectionValue === null || memberValue === null || primaryValue === null || selectedDeclarationsValue === null || valueValue === null || layoutValue === null || byteOffsetValue === null || byteAlignmentValue === null) return null;
  return { value: { id: idValue.value, occurrence: occurrenceValue.value, owner: ownerValue.value, selector: selectorValue.value, selection: selectionValue.value, member: memberValue.value, primary: primaryValue.value, selectedDeclarations: selectedDeclarationsValue.value, value: valueValue.value, layout: layoutValue.value, byteOffset: byteOffsetValue.value, byteAlignment: byteAlignmentValue.value } };
};
const observation: Decode<ObservationFact> = (state, input) => {
  const values = fields(state, input, "ObservationFact", ["node","operation","operand","layout","field","result","value","context","bindings"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const operationValue = literal(state, values[1], ["size","alignment","stride","field-offset"]);
  const operandValue = nodeRef(state, values[2]); const layoutValue = layoutRef(state, values[3]);
  const fieldValue = nullable(state, values[4], fieldRef); const resultValue = typeIdentity(state, values[5]);
  const valueValue = scalarBigint(state, values[6]); const contextValue = contextIdentity(state, values[7]);
  const bindingsValue = bindings(state, values[8]);
  if (nodeValue === null || operationValue === null || operandValue === null || layoutValue === null || fieldValue === null || resultValue === null || valueValue === null || contextValue === null || bindingsValue === null) return null;
  return { value: { node: nodeValue.value, operation: operationValue.value, operand: operandValue.value, layout: layoutValue.value, field: fieldValue.value, result: resultValue.value, value: valueValue.value, context: contextValue.value, bindings: bindingsValue.value } };
};
const rawLocation: Decode<RawLocationFact> = (state, input) => {
  const values = fields(state, input, "RawLocationFact", ["node","operation","pointee","layout","context","bindings"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const operationValue = literal(state, values[1], ["to-raw","reinterpret"]);
  const pointeeValue = typeIdentity(state, values[2]); const layoutValue = layoutRef(state, values[3]);
  const contextValue = contextIdentity(state, values[4]); const bindingsValue = bindings(state, values[5]);
  if (nodeValue === null || operationValue === null || pointeeValue === null || layoutValue === null || contextValue === null || bindingsValue === null) return null;
  return { value: { node: nodeValue.value, operation: operationValue.value, pointee: pointeeValue.value, layout: layoutValue.value, context: contextValue.value, bindings: bindingsValue.value } };
};
const fieldBinding: Decode<MemoryFieldBindingFact> = (state, input) => {
  const values = fields(state, input, "MemoryFieldBindingFact", ["node","result","owner","fieldExpression","field","pointer","pointee","context","bindings"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const resultValue = typeIdentity(state, values[1]);
  const ownerValue = typeIdentity(state, values[2]); const fieldExpressionValue = nodeRef(state, values[3]);
  const fieldValue = fieldRef(state, values[4]); const pointerValue = nodeRef(state, values[5]);
  const pointeeValue = typeIdentity(state, values[6]); const contextValue = contextIdentity(state, values[7]);
  const bindingsValue = bindings(state, values[8]);
  if (nodeValue === null || resultValue === null || ownerValue === null || fieldExpressionValue === null || fieldValue === null || pointerValue === null || pointeeValue === null || contextValue === null || bindingsValue === null) return null;
  return { value: { node: nodeValue.value, result: resultValue.value, owner: ownerValue.value, fieldExpression: fieldExpressionValue.value, field: fieldValue.value, pointer: pointerValue.value, pointee: pointeeValue.value, context: contextValue.value, bindings: bindingsValue.value } };
};
const boundRecordField: Decode<BoundRecordField> = (state, input) => {
  const values = fields(state, input, "BoundRecordField", ["expression","binding"]); if (values === null) return null;
  const expressionValue = nodeRef(state, values[0]); const bindingValue = node(state, values[1]);
  if (expressionValue === null || bindingValue === null) return null;
  return { value: { expression: expressionValue.value, binding: bindingValue.value } };
};
const recordBinding: Decode<MemoryRecordBindingFact> = (state, input) => {
  const values = fields(state, input, "MemoryRecordBindingFact", ["node","result","layoutExpression","layout","context","bindings","fields"]); if (values === null) return null;
  const nodeValue = node(state, values[0]); const resultValue = typeIdentity(state, values[1]);
  const layoutExpressionValue = nodeRef(state, values[2]); const layoutValue = layoutRef(state, values[3]);
  const contextValue = contextIdentity(state, values[4]); const bindingsValue = bindings(state, values[5]);
  const fieldsValue = sequence(state, values[6], boundRecordField);
  if (nodeValue === null || resultValue === null || layoutExpressionValue === null || layoutValue === null || contextValue === null || bindingsValue === null || fieldsValue === null) return null;
  return { value: { node: nodeValue.value, result: resultValue.value, layoutExpression: layoutExpressionValue.value, layout: layoutValue.value, context: contextValue.value, bindings: bindingsValue.value, fields: fieldsValue.value } };
};
const bodyFacts: Decode<BodyFacts> = (state, input) => {
  const values = fields(state, input, "BodyFacts", ["instance","arena","liveness","initialization","refinements","origins","suspension","errorStorage","pointerBacking","observations","rawLocations","fieldBindings","recordBindings","memoryBindings","selectedMemoryDeclarations","closedArrays"]); if (values === null) return null;
  const instanceValue = bodyInstance(state, values[0]); const arenaValue = arena(state, values[1]);
  const livenessValue = liveness(state, values[2]); const initializationValue = initialization(state, values[3]);
  const refinementsValue = refinements(state, values[4]); const originsValue = originFacts(state, values[5]);
  const suspensionValue = suspension(state, values[6]); const errorStorageValue = errorStorage(state, values[7]);
  const pointerBackingValue = pointerBacking(state, values[8]); const observationsValue = sequence(state, values[9], observation);
  const rawLocationsValue = sequence(state, values[10], rawLocation); const fieldBindingsValue = sequence(state, values[11], fieldBinding);
  const recordBindingsValue = sequence(state, values[12], recordBinding); const memoryBindingsValue = sequence(state, values[13], memoryInventory);
  const selectedMemoryDeclarationsValue = sequence(state, values[14], definition); const closedArraysValue = sequence(state, values[15], closedArray);
  if (instanceValue === null || arenaValue === null || livenessValue === null || initializationValue === null || refinementsValue === null || originsValue === null || suspensionValue === null || errorStorageValue === null || pointerBackingValue === null || observationsValue === null || rawLocationsValue === null || fieldBindingsValue === null || recordBindingsValue === null || memoryBindingsValue === null || selectedMemoryDeclarationsValue === null || closedArraysValue === null) return null;
  return { value: { instance: instanceValue.value, arena: arenaValue.value, liveness: livenessValue.value, initialization: initializationValue.value, refinements: refinementsValue.value, origins: originsValue.value, suspension: suspensionValue.value, errorStorage: errorStorageValue.value, pointerBacking: pointerBackingValue.value, observations: observationsValue.value, rawLocations: rawLocationsValue.value, fieldBindings: fieldBindingsValue.value, recordBindings: recordBindingsValue.value, memoryBindings: memoryBindingsValue.value, selectedMemoryDeclarations: selectedMemoryDeclarationsValue.value, closedArrays: closedArraysValue.value } };
};
const parameterEffect: Decode<ParameterEffect> = (state, input) => {
  const values = fields(state, input, "ParameterEffect", ["slot","reads","writes"]); if (values === null) return null;
  const slotValue = parameterSlot(state, values[0]); const readsValue = effectPaths(state, values[1]);
  const writesValue = effectPaths(state, values[2]);
  if (slotValue === null || readsValue === null || writesValue === null) return null;
  return { value: { slot: slotValue.value, reads: readsValue.value, writes: writesValue.value } };
};
const captureEffect: Decode<CaptureEffect> = (state, input) => {
  const values = fields(state, input, "CaptureEffect", ["index","reads","writes"]); if (values === null) return null;
  const indexValue = scalarNumber(state, values[0]); const readsValue = effectPaths(state, values[1]);
  const writesValue = effectPaths(state, values[2]);
  if (indexValue === null || readsValue === null || writesValue === null) return null;
  return { value: { index: indexValue.value, reads: readsValue.value, writes: writesValue.value } };
};
const summaryWrite: Decode<SummaryWrite> = (state, input) => {
  const values = fields(state, input, "SummaryWrite", ["target","value"]); if (values === null) return null;
  const targetValue = producerIdentity(state, values[0]); const valueValue = originsIdentity(state, values[1]);
  if (targetValue === null || valueValue === null) return null;
  return { value: { target: targetValue.value, value: valueValue.value } };
};
const summaryCallback: Decode<SummaryCallback> = (state, input) => {
  const values = fields(state, input, "SummaryCallback", ["parameterIndex","timing","rejection","inputs"]); if (values === null) return null;
  const parameterIndexValue = scalarNumber(state, values[0]); const timingValue = literal(state, values[1], ["synchronous","deferred"]);
  const rejectionValue = nullable(state, values[2], scalarNumber); const inputsValue = sequence(state, values[3], callbackInput);
  if (parameterIndexValue === null || timingValue === null || rejectionValue === null || inputsValue === null) return null;
  return { value: { parameterIndex: parameterIndexValue.value, timing: timingValue.value, rejection: rejectionValue.value, inputs: inputsValue.value } };
};
const summary: Decode<Summary> = (state, input) => {
  const values = fields(state, input, "Summary", ["key","signature","arena","parameters","captures","result","thrown","writes","retention","callbacks","invocationOnlyParameters","suspends","bindingDependent"]); if (values === null) return null;
  const keyValue = summaryKey(state, values[0]); const signatureValue = signature(state, values[1]);
  const arenaValue = arena(state, values[2]); const parametersValue = sequence(state, values[3], parameterEffect);
  const capturesValue = sequence(state, values[4], captureEffect); const resultValue = originsIdentity(state, values[5]);
  const thrownValue = originsIdentity(state, values[6]); const writesValue = sequence(state, values[7], summaryWrite);
  const retentionValue = sequence(state, values[8], retention); const callbacksValue = sequence(state, values[9], summaryCallback);
  const invocationOnlyParametersValue = sequence(state, values[10], scalarNumber); const suspendsValue = scalarBoolean(state, values[11]);
  const bindingDependentValue = scalarBoolean(state, values[12]);
  if (keyValue === null || signatureValue === null || arenaValue === null || parametersValue === null || capturesValue === null || resultValue === null || thrownValue === null || writesValue === null || retentionValue === null || callbacksValue === null || invocationOnlyParametersValue === null || suspendsValue === null || bindingDependentValue === null) return null;
  return { value: { key: keyValue.value, signature: signatureValue.value, arena: arenaValue.value, parameters: parametersValue.value, captures: capturesValue.value, result: resultValue.value, thrown: thrownValue.value, writes: writesValue.value, retention: retentionValue.value, callbacks: callbacksValue.value, invocationOnlyParameters: invocationOnlyParametersValue.value, suspends: suspendsValue.value, bindingDependent: bindingDependentValue.value } };
};
const callComponent: Decode<CallComponent> = (state, input) => {
  const values = fields(state, input, "CallComponent", ["id","definitions","dependencies"]); if (values === null) return null;
  const idValue = component(state, values[0]); const definitionsValue = sequence(state, values[1], definition);
  const dependenciesValue = sequence(state, values[2], component);
  if (idValue === null || definitionsValue === null || dependenciesValue === null) return null;
  return { value: { id: idValue.value, definitions: definitionsValue.value, dependencies: dependenciesValue.value } };
};
const callEdge: Decode<CallEdge> = (state, input) => {
  const kind = label(state, input, ["direct","indirect","getter","setter","constructor","initializer","callback"]); if (kind === null) return null;
  const values = fields(state, input, kind.value, ["caller","at","callee","bindings"]); if (values === null) return null;
  const callerValue = definition(state, values[0]); const atValue = nodeRef(state, values[1]);
  const calleeValue = callCallee(state, values[2]); const bindingsValue = artifact(state, values[3]);
  if (callerValue === null || atValue === null || calleeValue === null || bindingsValue === null) return null;
  return { value: { kind: kind.value, caller: callerValue.value, at: atValue.value, callee: calleeValue.value, bindings: bindingsValue.value } };
};
const callGraph: Decode<CallGraph> = (state, input) => {
  const values = fields(state, input, "CallGraph", ["definitions","edges","components"]); if (values === null) return null;
  const definitionsValue = sequence(state, values[0], definition); const edgesValue = sequence(state, values[1], callEdge);
  const componentsValue = sequence(state, values[2], callComponent);
  if (definitionsValue === null || edgesValue === null || componentsValue === null) return null;
  return { value: { definitions: definitionsValue.value, edges: edgesValue.value, components: componentsValue.value } };
};
