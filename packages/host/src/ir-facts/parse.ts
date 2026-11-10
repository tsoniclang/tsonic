import type { TextParseResult } from "../diag/contract.js";
import type {
  BlockId, BoundProducerId, ComponentId, DefId, LayoutId, LibraryExportIdentity, LibraryModuleIdentity,
  LocalId, LocalRef, MemoryFieldId, NodeId, NodeRef, OpenBoundaryId, OriginsId, PlaceId, ProducerId, ItemNodeRef,
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
interface State { readonly text: string }
type Decoded<Value> = { readonly kind: "value"; readonly value: Value } | { readonly kind: "invalid"; readonly failure: Failure };
type Decode<Value> = (state: State, input: SyntaxValue | undefined) => Decoded<Value>;
type Frame = { readonly kind: "array"; readonly offset: number; readonly values: SyntaxValue[]; phase: "first" | "value" | "separator" }
  | { readonly kind: "record"; readonly offset: number; readonly label: string; readonly fields: SyntaxField[];
      phase: "first" | "field" | "equals" | "value" | "separator"; name: string; fieldOffset: number };

const reject = (_state: State, offset: number, expected: readonly string[]): Decoded<never> =>
  ({ kind: "invalid", failure: { offset, expected } });
const accept = <Value>(value: Value): Decoded<Value> => ({ kind: "value", value });
const then = <Value, Output>(result: Decoded<Value>, next: (value: Value) => Decoded<Output>): Decoded<Output> =>
  result.kind === "invalid" ? result : next(result.value);
const fail = (state: State, input: SyntaxValue | undefined, expected: readonly string[]): Decoded<never> =>
  reject(state, input === undefined ? state.text.length : input.offset, expected);
const lex = (state: State): Decoded<readonly Token[]> => {
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
  return accept(tokens);
};
const syntax = (state: State, tokens: readonly Token[]): Decoded<SyntaxValue> => {
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
  return root === null ? reject(state, state.text.length, ["record"]) : accept(root);
};
const fields = (state: State, input: SyntaxValue | undefined, label: string, names: readonly string[]): Decoded<readonly SyntaxValue[]> => {
  if (input?.kind !== "record" || input.label !== label) return fail(state, input, [label]);
  for (let index = 0; index < Math.max(input.fields.length, names.length); index += 1) {
    const actual = input.fields[index];
    const expected = names[index];
    if (actual === undefined) return reject(state, input.end, expected === undefined ? [")"] : [expected]);
    if (actual.name !== expected) return reject(state, actual.offset, expected === undefined ? [")"] : [expected]);
  }
  return accept(input.fields.map(field => field.value));
};
const scalarString: Decode<string> = (state, input) => input?.kind === "scalar" && typeof input.value === "string"
  ? accept(input.value) : fail(state, input, ["string"]);
const scalarNumber: Decode<number> = (state, input) => input?.kind === "scalar" && typeof input.value === "number"
  ? accept(input.value) : fail(state, input, ["number"]);
const scalarBigint: Decode<bigint> = (state, input) => input?.kind === "scalar" && typeof input.value === "bigint"
  ? accept(input.value) : fail(state, input, ["bigint"]);
const scalarBoolean: Decode<boolean> = (state, input) => input?.kind === "scalar" && typeof input.value === "boolean"
  ? accept(input.value) : fail(state, input, ["boolean"]);
const literal = <Value extends string | number>(state: State, input: SyntaxValue | undefined, values: readonly Value[]): Decoded<Value> => {
  if (input?.kind === "scalar") for (const value of values) if (value === input.value) return accept(value);
  return fail(state, input, values.map(value => typeof value === "string" ? JSON.stringify(value) : String(value)));
};
const nullable = <Value>(state: State, input: SyntaxValue | undefined, decode: Decode<Value>): Decoded<Value | null> =>
  input?.kind === "scalar" && input.value === null ? accept(null) : decode(state, input);
const sequence = <Value>(state: State, input: SyntaxValue | undefined, decode: Decode<Value>): Decoded<readonly Value[]> => {
  if (input?.kind !== "array") return fail(state, input, ["array"]);
  const values: Value[] = [];
  for (const item of input.values) {
    const decoded = decode(state, item);
    if (decoded.kind === "invalid") return decoded;
    values.push(decoded.value);
  }
  return accept(Object.freeze(values));
};
const nonempty = <Value>(state: State, input: SyntaxValue | undefined, decode: Decode<Value>): Decoded<readonly [Value, ...Value[]]> => {
  if (input?.kind !== "array" || input.values.length === 0) return fail(state, input, ["nonempty array"]);
  return then(decode(state, input.values[0]), first => {
    const rest: Value[] = [];
    for (let index = 1; index < input.values.length; index += 1) {
      const item = decode(state, input.values[index]);
      if (item.kind === "invalid") return item;
      rest.push(item.value);
    }
    const result: readonly [Value, ...Value[]] = [first, ...rest];
    return accept(Object.freeze(result));
  });
};
const numeric = <Identity extends number>(state: State, input: SyntaxValue | undefined, prefix: string,
  validate: (value: number) => value is Identity): Decoded<Identity> =>
  input?.kind === "identity" && input.prefix === prefix && typeof input.value === "number" && validate(input.value)
    ? accept(input.value) : fail(state, input, [prefix + ":integer"]);
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
  return decoded.kind === "decoded" ? accept(encodeDefId(decoded.value)) : fail(state, input, ["canonical DefId"]);
};
const body: Decode<BodyId> = (state, input) => {
  if (input?.kind !== "identity" || input.prefix !== "body" || typeof input.value !== "string") return fail(state, input, ["body:string"]);
  const decoded = decodeBodyId(input.value);
  return decoded.kind === "decoded" ? accept(encodeBodyId(decoded.value)) : fail(state, input, ["canonical BodyId"]);
};
const component: Decode<ComponentId> = (state, input) => {
  if (input?.kind !== "identity" || input.prefix !== "component" || typeof input.value !== "string") return fail(state, input, ["component:string"]);
  const decoded = decodeComponentId(input.value);
  return decoded.kind === "decoded" ? accept(encodeComponentId(decoded.value)) : fail(state, input, ["canonical ComponentId"]);
};
const label = <Name extends string>(state: State, input: SyntaxValue | undefined, names: readonly Name[]): Decoded<Name> => {
  if (input?.kind === "record") for (const name of names) if (input.label === name) return accept(name);
  return fail(state, input, names);
};
const nodeRef: Decode<NodeRef> = (state, input) => then(fields(state, input, "NodeRef", ["body","node"]), values =>
    then(body(state, values[0]), bodyValue =>
    then(node(state, values[1]), nodeValue =>
      accept<NodeRef>({ body: bodyValue, node: nodeValue }))));
const localRef: Decode<LocalRef> = (state, input) => then(fields(state, input, "LocalRef", ["body","local"]), values =>
    then(body(state, values[0]), bodyValue =>
    then(local(state, values[1]), localValue =>
      accept<LocalRef>({ body: bodyValue, local: localValue }))));
const parameterIdentity: Decode<TypeParameterIdentity> = (state, input) => then(fields(state, input, "TypeParameterIdentity", ["owner","index"]), values =>
    then(definition(state, values[0]), ownerValue =>
    then(scalarNumber(state, values[1]), indexValue =>
      accept<TypeParameterIdentity>({ owner: ownerValue, index: indexValue }))));
const bindings: Decode<BindingVector> = (state, input) => then(fields(state, input, "BindingVector", ["classBindings","methodBindings","capturedBindings","selfBindings"]), values =>
    then(sequence(state, values[0], typeBinding), classBindingsValue =>
    then(sequence(state, values[1], typeBinding), methodBindingsValue =>
    then(sequence(state, values[2], typeBinding), capturedBindingsValue =>
    then(sequence(state, values[3], selfBinding), selfBindingsValue =>
      accept<BindingVector>({ classBindings: classBindingsValue, methodBindings: methodBindingsValue, capturedBindings: capturedBindingsValue, selfBindings: selfBindingsValue }))))));
const bodyInstance: Decode<BodyInstance> = (state, input) => then(fields(state, input, "BodyInstance", ["body","bindings"]), values =>
    then(body(state, values[0]), bodyValue =>
    then(artifact(state, values[1]), bindingsValue =>
      accept<BodyInstance>({ body: bodyValue, bindings: bindingsValue }))));
const rational: Decode<ExactRational> = (state, input) => then(fields(state, input, "ExactRational", ["numerator","denominator","negativeZero"]), values =>
    then(scalarBigint(state, values[0]), numeratorValue =>
    then(scalarBigint(state, values[1]), denominatorValue =>
    then(scalarBoolean(state, values[2]), negativeZeroValue =>
      accept<ExactRational>({ numerator: numeratorValue, denominator: denominatorValue, negativeZero: negativeZeroValue })))));
const endpoint: Decode<HirCallableEndpoint> = (state, input) => then(fields(state, input, "HirCallableEndpoint", ["declaration","role","signature","body"]), values =>
    then(definition(state, values[0]), declarationValue =>
    then(literal(state, values[1], ["advertised","api-signature","api-body"]), roleValue =>
    then(signature(state, values[2]), signatureValue =>
    then(nullable(state, values[3], body), bodyValue =>
      accept<HirCallableEndpoint>({ declaration: declarationValue, role: roleValue, signature: signatureValue, body: bodyValue }))))));
const completion: Decode<CompletionEndpoint> = (state, input) => then(fields(state, input, "CompletionEndpoint", ["signature","completion","yielded","sent"]), values =>
    then(signature(state, values[0]), signatureValue =>
    then(typeIdentity(state, values[1]), completionValue =>
    then(nullable(state, values[2], typeIdentity), yieldedValue =>
    then(nullable(state, values[3], typeIdentity), sentValue =>
      accept<CompletionEndpoint>({ signature: signatureValue, completion: completionValue, yielded: yieldedValue, sent: sentValue }))))));
const application: Decode<ApplicationDecision> = (state, input) => then(fields(state, input, "ApplicationDecision", ["candidate","advertised","api","bindings","implementationBindings","parameters","completion","result"]), values =>
    then(scalarNumber(state, values[0]), candidateValue =>
    then(endpoint(state, values[1]), advertisedValue =>
    then(endpoint(state, values[2]), apiValue =>
    then(bindings(state, values[3]), bindingsValue =>
    then(nullable(state, values[4], bindings), implementationBindingsValue =>
    then(sequence(state, values[5], parameterMapping), parametersValue =>
    then(completion(state, values[6]), completionValue =>
    then(typeIdentity(state, values[7]), resultValue =>
      accept<ApplicationDecision>({ candidate: candidateValue, advertised: advertisedValue, api: apiValue, bindings: bindingsValue, implementationBindings: implementationBindingsValue, parameters: parametersValue, completion: completionValue, result: resultValue }))))))))));
const memberDecision: Decode<MemberDecision> = (state, input) => then(fields(state, input, "MemberDecision", ["key","origins","selectedDeclarations","primary","read","write","getter","setter","bindings"]), values =>
    then(memberKey(state, values[0]), keyValue =>
    then(sequence(state, values[1], memberOrigin), originsValue =>
    then(sequence(state, values[2], definition), selectedDeclarationsValue =>
    then(nullable(state, values[3], definition), primaryValue =>
    then(nullable(state, values[4], typeIdentity), readValue =>
    then(nullable(state, values[5], typeIdentity), writeValue =>
    then(nullable(state, values[6], endpoint), getterValue =>
    then(nullable(state, values[7], endpoint), setterValue =>
    then(bindings(state, values[8]), bindingsValue =>
      accept<MemberDecision>({ key: keyValue, origins: originsValue, selectedDeclarations: selectedDeclarationsValue, primary: primaryValue, read: readValue, write: writeValue, getter: getterValue, setter: setterValue, bindings: bindingsValue })))))))))));
const resolved: Decode<ResolvedCallee> = (state, input) => then(fields(state, input, "ResolvedCallee", ["decision","activation","captures"]), values =>
    then(application(state, values[0]), decisionValue =>
    then(nullable(state, values[1], bodyInstance), activationValue =>
    then(sequence(state, values[2], localRef), capturesValue =>
      accept<ResolvedCallee>({ decision: decisionValue, activation: activationValue, captures: capturesValue })))));
const memberSelection: Decode<MemberSelection> = (state, input) => then(fields(state, input, "MemberSelection", ["decision","getter","setter"]), values =>
    then(memberDecision(state, values[0]), decisionValue =>
    then(nullable(state, values[1], resolved), getterValue =>
    then(nullable(state, values[2], resolved), setterValue =>
      accept<MemberSelection>({ decision: decisionValue, getter: getterValue, setter: setterValue })))));
const libraryModule: Decode<LibraryModuleIdentity> = (state, input) => then(fields(state, input, "LibraryModuleIdentity", ["providerId","providerVersion","packageName","moduleSpecifier","providerModuleId"]), values =>
    then(scalarString(state, values[0]), providerIdValue =>
    then(scalarString(state, values[1]), providerVersionValue =>
    then(nullable(state, values[2], scalarString), packageNameValue =>
    then(scalarString(state, values[3]), moduleSpecifierValue =>
    then(scalarString(state, values[4]), providerModuleIdValue =>
      accept<LibraryModuleIdentity>({ providerId: providerIdValue, providerVersion: providerVersionValue, packageName: packageNameValue, moduleSpecifier: moduleSpecifierValue, providerModuleId: providerModuleIdValue })))))));
const libraryExport: Decode<LibraryExportIdentity> = (state, input) => then(fields(state, input, "LibraryExportIdentity", ["module","exportId","memberId","signatureId"]), values =>
    then(libraryModule(state, values[0]), moduleValue =>
    then(scalarString(state, values[1]), exportIdValue =>
    then(nullable(state, values[2], scalarString), memberIdValue =>
    then(nullable(state, values[3], scalarString), signatureIdValue =>
      accept<LibraryExportIdentity>({ module: moduleValue, exportId: exportIdValue, memberId: memberIdValue, signatureId: signatureIdValue }))))));
const producerRef: Decode<ProducerRef> = (state, input) => then(fields(state, input, "ProducerRef", ["owner","producer"]), values =>
    then(owner(state, values[0]), ownerValue =>
    then(producerIdentity(state, values[1]), producerValue =>
      accept<ProducerRef>({ owner: ownerValue, producer: producerValue }))));
const boundaryRef: Decode<OpenBoundaryRef> = (state, input) => then(fields(state, input, "OpenBoundaryRef", ["owner","boundary"]), values =>
    then(owner(state, values[0]), ownerValue =>
    then(boundary(state, values[1]), boundaryValue =>
      accept<OpenBoundaryRef>({ owner: ownerValue, boundary: boundaryValue }))));
const projectionPath: Decode<ProjectionPath> = (state, input) => then(fields(state, input, "ProjectionPath", ["id","parent","projection"]), values =>
    then(path(state, values[0]), idValue =>
    then(nullable(state, values[1], path), parentValue =>
    then(projection(state, values[2]), projectionValue =>
      accept<ProjectionPath>({ id: idValue, parent: parentValue, projection: projectionValue })))));
const captureLocation: Decode<CaptureLocation> = (state, input) => then(fields(state, input, "CaptureLocation", ["index","location"]), values =>
    then(scalarNumber(state, values[0]), indexValue =>
    then(bound(state, values[1]), locationValue =>
      accept<CaptureLocation>({ index: indexValue, location: locationValue }))));
const valueContext: Decode<ValueContext> = (state, input) => then(fields(state, input, "ValueContext", ["id","receiver","arguments","captures"]), values =>
    then(contextIdentity(state, values[0]), idValue =>
    then(nullable(state, values[1], originsIdentity), receiverValue =>
    then(sequence(state, values[2], originsIdentity), argumentsValue =>
    then(sequence(state, values[3], captureLocation), capturesValue =>
      accept<ValueContext>({ id: idValue, receiver: receiverValue, arguments: argumentsValue, captures: capturesValue }))))));
const boundProducer: Decode<BoundProducer> = (state, input) => then(fields(state, input, "BoundProducer", ["id","producer","bindings","context"]), values =>
    then(bound(state, values[0]), idValue =>
    then(producerIdentity(state, values[1]), producerValue =>
    then(bindings(state, values[2]), bindingsValue =>
    then(contextIdentity(state, values[3]), contextValue =>
      accept<BoundProducer>({ id: idValue, producer: producerValue, bindings: bindingsValue, context: contextValue }))))));
const openBoundary: Decode<OpenBoundary> = (state, input) => then(label(state, input, ["external-input","external-write","opaque-write","opaque-result","unclassified-exposure","opaque-invocation","unresolved-transport"]), kind =>
  then(fields(state, input, kind, ["id","at","subject","owner","bindings","context","detail"]), values =>
    then(boundary(state, values[0]), idValue =>
    then(site(state, values[1]), atValue =>
    then(producerIdentity(state, values[2]), subjectValue =>
    then(nullable(state, values[3], producerIdentity), ownerValue =>
    then(bindings(state, values[4]), bindingsValue =>
    then(contextIdentity(state, values[5]), contextValue =>
    then(scalarString(state, values[6]), detailValue =>
      accept<OpenBoundary>({ kind: kind, id: idValue, at: atValue, subject: subjectValue, owner: ownerValue, bindings: bindingsValue, context: contextValue, detail: detailValue }))))))))));
const arena: Decode<RelationalArena> = (state, input) => then(fields(state, input, "RelationalArena", ["projections","producers","contexts","boundProducers","origins","boundaries"]), values =>
    then(sequence(state, values[0], projectionPath), projectionsValue =>
    then(sequence(state, values[1], producer), producersValue =>
    then(sequence(state, values[2], valueContext), contextsValue =>
    then(sequence(state, values[3], boundProducer), boundProducersValue =>
    then(sequence(state, values[4], origins), originsValue =>
    then(sequence(state, values[5], openBoundary), boundariesValue =>
      accept<RelationalArena>({ projections: projectionsValue, producers: producersValue, contexts: contextsValue, boundProducers: boundProducersValue, origins: originsValue, boundaries: boundariesValue }))))))));
const mirPoint: Decode<MirPoint> = (state, input) => then(fields(state, input, "MirPoint", ["block","statement"]), values =>
    then(block(state, values[0]), blockValue =>
    then(nullable(state, values[1], scalarNumber), statementValue =>
      accept<MirPoint>({ block: blockValue, statement: statementValue }))));
const storeLiveness: Decode<StoreLiveness> = (state, input) => then(fields(state, input, "StoreLiveness", ["node","point","observed"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(mirPoint(state, values[1]), pointValue =>
    then(scalarBoolean(state, values[2]), observedValue =>
      accept<StoreLiveness>({ node: nodeValue, point: pointValue, observed: observedValue })))));
const liveSegment: Decode<LiveSegment> = (state, input) => then(fields(state, input, "LiveSegment", ["block","first","last"]), values =>
    then(block(state, values[0]), blockValue =>
    then(scalarNumber(state, values[1]), firstValue =>
    then(scalarNumber(state, values[2]), lastValue =>
      accept<LiveSegment>({ block: blockValue, first: firstValue, last: lastValue })))));
const localLiveRange: Decode<LocalLiveRange> = (state, input) => then(fields(state, input, "LocalLiveRange", ["local","segments"]), values =>
    then(local(state, values[0]), localValue =>
    then(sequence(state, values[1], liveSegment), segmentsValue =>
      accept<LocalLiveRange>({ local: localValue, segments: segmentsValue }))));
const bindingStorage: Decode<BindingStorageFact> = (state, input) => then(fields(state, input, "BindingStorageFact", ["local","scope","captured"]), values =>
    then(local(state, values[0]), localValue =>
    then(literal(state, values[1], ["body","shared"]), scopeValue =>
    then(scalarBoolean(state, values[2]), capturedValue =>
      accept<BindingStorageFact>({ local: localValue, scope: scopeValue, captured: capturedValue })))));
const captureFact: Decode<CaptureFact> = (state, input) => then(fields(state, input, "CaptureFact", ["local","reads","writes"]), values =>
    then(localRef(state, values[0]), localValue =>
    then(scalarBoolean(state, values[1]), readsValue =>
    then(scalarBoolean(state, values[2]), writesValue =>
      accept<CaptureFact>({ local: localValue, reads: readsValue, writes: writesValue })))));
const liveness: Decode<LivenessFacts> = (state, input) => then(fields(state, input, "LivenessFacts", ["stores","locals","bindings","captures"]), values =>
    then(sequence(state, values[0], storeLiveness), storesValue =>
    then(sequence(state, values[1], localLiveRange), localsValue =>
    then(sequence(state, values[2], bindingStorage), bindingsValue =>
    then(sequence(state, values[3], captureFact), capturesValue =>
      accept<LivenessFacts>({ stores: storesValue, locals: localsValue, bindings: bindingsValue, captures: capturesValue }))))));
const initializationFact: Decode<InitializationFact> = (state, input) => then(fields(state, input, "InitializationFact", ["node","place","assigned"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(place(state, values[1]), placeValue =>
    then(scalarBoolean(state, values[2]), assignedValue =>
      accept<InitializationFact>({ node: nodeValue, place: placeValue, assigned: assignedValue })))));
const initialization: Decode<InitializationFacts> = (state, input) => then(fields(state, input, "InitializationFacts", ["reads"]), values =>
    then(sequence(state, values[0], initializationFact), readsValue =>
      accept<InitializationFacts>({ reads: readsValue })));
const refinementInvalidation: Decode<RefinementInvalidation> = (state, input) => then(label(state, input, ["write","call"]), kind =>
  then(fields(state, input, kind, ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<RefinementInvalidation>({ kind: kind, at: atValue }))));
const integerRange: Decode<IntegerRange> = (state, input) => then(fields(state, input, "IntegerRange", ["minimum","maximum"]), values =>
    then(scalarBigint(state, values[0]), minimumValue =>
    then(scalarBigint(state, values[1]), maximumValue =>
      accept<IntegerRange>({ minimum: minimumValue, maximum: maximumValue }))));
const integerFact: Decode<IntegerFact> = (state, input) => then(fields(state, input, "IntegerFact", ["node","range","nonnegative"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(nullable(state, values[1], integerRange), rangeValue =>
    then(scalarBoolean(state, values[2]), nonnegativeValue =>
      accept<IntegerFact>({ node: nodeValue, range: rangeValue, nonnegative: nonnegativeValue })))));
const countedLoop: Decode<CountedLoopFact> = (state, input) => then(fields(state, input, "CountedLoopFact", ["statement","counterDeclaration","start","bound","body","direction","comparison","step"]), values =>
    then(node(state, values[0]), statementValue =>
    then(node(state, values[1]), counterDeclarationValue =>
    then(node(state, values[2]), startValue =>
    then(node(state, values[3]), boundValue =>
    then(node(state, values[4]), bodyValue =>
    then(literal(state, values[5], ["ascending"]), directionValue =>
    then(literal(state, values[6], ["exclusive-upper-bound"]), comparisonValue =>
    then(literal(state, values[7], [1]), stepValue =>
      accept<CountedLoopFact>({ statement: statementValue, counterDeclaration: counterDeclarationValue, start: startValue, bound: boundValue, body: bodyValue, direction: directionValue, comparison: comparisonValue, step: stepValue }))))))))));
const refinements: Decode<RefinementFacts> = (state, input) => then(fields(state, input, "RefinementFacts", ["refinements","integers","countedLoops"]), values =>
    then(sequence(state, values[0], refinementFact), refinementsValue =>
    then(sequence(state, values[1], integerFact), integersValue =>
    then(sequence(state, values[2], countedLoop), countedLoopsValue =>
      accept<RefinementFacts>({ refinements: refinementsValue, integers: integersValue, countedLoops: countedLoopsValue })))));
const readOrigins: Decode<ReadOriginsFact> = (state, input) => then(fields(state, input, "ReadOriginsFact", ["node","place","origins"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(place(state, values[1]), placeValue =>
    then(originsIdentity(state, values[2]), originsValue =>
      accept<ReadOriginsFact>({ node: nodeValue, place: placeValue, origins: originsValue })))));
const pointOrigins: Decode<PointPlaceOrigins> = (state, input) => then(fields(state, input, "PointPlaceOrigins", ["point","place","origins"]), values =>
    then(mirPoint(state, values[0]), pointValue =>
    then(place(state, values[1]), placeValue =>
    then(originsIdentity(state, values[2]), originsValue =>
      accept<PointPlaceOrigins>({ point: pointValue, place: placeValue, origins: originsValue })))));
const subjectOrigins: Decode<SubjectOriginsFact> = (state, input) => then(fields(state, input, "SubjectOriginsFact", ["node","role","path","origins"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(literal(state, values[1], ["input","value","member","return","receiver"]), roleValue =>
    then(nullable(state, values[2], path), pathValue =>
    then(originsIdentity(state, values[3]), originsValue =>
      accept<SubjectOriginsFact>({ node: nodeValue, role: roleValue, path: pathValue, origins: originsValue }))))));
const writtenReason: Decode<WrittenOriginsReason> = (state, input) => then(label(state, input, ["value-source-unproven"]), kind =>
  then(fields(state, input, kind, ["detail"]), values =>
    then(scalarString(state, values[0]), detailValue =>
      accept<WrittenOriginsReason>({ kind: kind, detail: detailValue }))));
const writtenOrigins: Decode<WrittenOrigins> = (state, input) => then(fields(state, input, "WrittenOrigins", ["source","origins","reason"]), values =>
    then(nullable(state, values[0], nodeRef), sourceValue =>
    then(originsIdentity(state, values[1]), originsValue =>
    then(nullable(state, values[2], writtenReason), reasonValue =>
      accept<WrittenOrigins>({ source: sourceValue, origins: originsValue, reason: reasonValue })))));
const writeFact: Decode<WriteFact> = (state, input) => then(fields(state, input, "WriteFact", ["node","operation","destination","targets","owner","values","boundaries"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(literal(state, values[1], ["initialization","mutation"]), operationValue =>
    then(literal(state, values[2], ["binding","member","element","pointer"]), destinationValue =>
    then(sequence(state, values[3], bound), targetsValue =>
    then(nullable(state, values[4], bound), ownerValue =>
    then(sequence(state, values[5], writtenOrigins), valuesValue =>
    then(sequence(state, values[6], boundary), boundariesValue =>
      accept<WriteFact>({ node: nodeValue, operation: operationValue, destination: destinationValue, targets: targetsValue, owner: ownerValue, values: valuesValue, boundaries: boundariesValue })))))))));
const escapeFact: Decode<EscapeFact> = (state, input) => then(fields(state, input, "EscapeFact", ["node","producer","target"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(producerIdentity(state, values[1]), producerValue =>
    then(escapeTarget(state, values[2]), targetValue =>
      accept<EscapeFact>({ node: nodeValue, producer: producerValue, target: targetValue })))));
const argumentTransport: Decode<ArgumentTransport> = (state, input) => then(fields(state, input, "ArgumentTransport", ["authoredIndex","parameter","parameterIndex","effectiveIndex","repeated","passing","actual","formal","projection"]), values =>
    then(nullable(state, values[0], scalarNumber), authoredIndexValue =>
    then(definition(state, values[1]), parameterValue =>
    then(scalarNumber(state, values[2]), parameterIndexValue =>
    then(scalarNumber(state, values[3]), effectiveIndexValue =>
    then(scalarBoolean(state, values[4]), repeatedValue =>
    then(literal(state, values[5], ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]), passingValue =>
    then(originsIdentity(state, values[6]), actualValue =>
    then(producerRef(state, values[7]), formalValue =>
    then(nullable(state, values[8], path), projectionValue =>
      accept<ArgumentTransport>({ authoredIndex: authoredIndexValue, parameter: parameterValue, parameterIndex: parameterIndexValue, effectiveIndex: effectiveIndexValue, repeated: repeatedValue, passing: passingValue, actual: actualValue, formal: formalValue, projection: projectionValue })))))))))));
const summaryKey: Decode<SummaryKey> = (state, input) => then(fields(state, input, "SummaryKey", ["definition","bindings"]), values =>
    then(definition(state, values[0]), definitionValue =>
    then(artifact(state, values[1]), bindingsValue =>
      accept<SummaryKey>({ definition: definitionValue, bindings: bindingsValue }))));
const invocationAlternative: Decode<InvocationAlternative> = (state, input) => then(fields(state, input, "InvocationAlternative", ["resolution","context","arguments","result","thrown","summary"]), values =>
    then(resolved(state, values[0]), resolutionValue =>
    then(contextIdentity(state, values[1]), contextValue =>
    then(sequence(state, values[2], argumentTransport), argumentsValue =>
    then(originsIdentity(state, values[3]), resultValue =>
    then(originsIdentity(state, values[4]), thrownValue =>
    then(summaryKey(state, values[5]), summaryValue =>
      accept<InvocationAlternative>({ resolution: resolutionValue, context: contextValue, arguments: argumentsValue, result: resultValue, thrown: thrownValue, summary: summaryValue }))))))));
const invocationFact: Decode<InvocationFact> = (state, input) => then(label(state, input, ["call","construct","getter","setter","native-callback"]), kind =>
  then(fields(state, input, kind, ["node","alternatives","boundaries"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(sequence(state, values[1], invocationAlternative), alternativesValue =>
    then(sequence(state, values[2], boundary), boundariesValue =>
      accept<InvocationFact>({ kind: kind, node: nodeValue, alternatives: alternativesValue, boundaries: boundariesValue }))))));
const callbackEntry: Decode<CallbackEntry> = (state, input) => then(fields(state, input, "CallbackEntry", ["node","argument","timing","rejection","inputs"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(argumentTransport(state, values[1]), argumentValue =>
    then(literal(state, values[2], ["synchronous","deferred","unknown"]), timingValue =>
    then(nullable(state, values[3], scalarNumber), rejectionValue =>
    then(sequence(state, values[4], callbackInput), inputsValue =>
      accept<CallbackEntry>({ node: nodeValue, argument: argumentValue, timing: timingValue, rejection: rejectionValue, inputs: inputsValue })))))));
const activation: Decode<BoundActivation> = (state, input) => then(fields(state, input, "BoundActivation", ["node","definition","context","caller","entry"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(definition(state, values[1]), definitionValue =>
    then(contextIdentity(state, values[2]), contextValue =>
    then(nullable(state, values[3], contextIdentity), callerValue =>
    then(nullable(state, values[4], argumentTransport), entryValue =>
      accept<BoundActivation>({ node: nodeValue, definition: definitionValue, context: contextValue, caller: callerValue, entry: entryValue })))))));
const frontier: Decode<ValueFrontier> = (state, input) => then(label(state, input, ["boundary","origin"]), kind =>
  then(fields(state, input, kind, ["node","subject","context"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(producerIdentity(state, values[1]), subjectValue =>
    then(contextIdentity(state, values[2]), contextValue =>
      accept<ValueFrontier>({ kind: kind, node: nodeValue, subject: subjectValue, context: contextValue }))))));
const instanceRegion: Decode<InstanceRegion> = (state, input) => then(fields(state, input, "InstanceRegion", ["owner","node","context"]), values =>
    then(definition(state, values[0]), ownerValue =>
    then(nodeRef(state, values[1]), nodeValue =>
    then(contextIdentity(state, values[2]), contextValue =>
      accept<InstanceRegion>({ owner: ownerValue, node: nodeValue, context: contextValue })))));
const construction: Decode<ConstructionAlternative> = (state, input) => then(fields(state, input, "ConstructionAlternative", ["node","root","allocation","implementation","body","regions"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(nodeRef(state, values[1]), rootValue =>
    then(nodeRef(state, values[2]), allocationValue =>
    then(nullable(state, values[3], definition), implementationValue =>
    then(nullable(state, values[4], bodyInstance), bodyValue =>
    then(sequence(state, values[5], instanceRegion), regionsValue =>
      accept<ConstructionAlternative>({ node: nodeValue, root: rootValue, allocation: allocationValue, implementation: implementationValue, body: bodyValue, regions: regionsValue }))))))));
const originFacts: Decode<OriginFacts> = (state, input) => then(fields(state, input, "OriginFacts", ["points","reads","subjects","writes","escapes","invocations","callbacks","activations","frontiers","constructions","instanceRegions"]), values =>
    then(sequence(state, values[0], pointOrigins), pointsValue =>
    then(sequence(state, values[1], readOrigins), readsValue =>
    then(sequence(state, values[2], subjectOrigins), subjectsValue =>
    then(sequence(state, values[3], writeFact), writesValue =>
    then(sequence(state, values[4], escapeFact), escapesValue =>
    then(sequence(state, values[5], invocationFact), invocationsValue =>
    then(sequence(state, values[6], callbackEntry), callbacksValue =>
    then(sequence(state, values[7], activation), activationsValue =>
    then(sequence(state, values[8], frontier), frontiersValue =>
    then(sequence(state, values[9], construction), constructionsValue =>
    then(sequence(state, values[10], instanceRegion), instanceRegionsValue =>
      accept<OriginFacts>({ points: pointsValue, reads: readsValue, subjects: subjectsValue, writes: writesValue, escapes: escapesValue, invocations: invocationsValue, callbacks: callbacksValue, activations: activationsValue, frontiers: frontiersValue, constructions: constructionsValue, instanceRegions: instanceRegionsValue })))))))))))));
const retention: Decode<RetentionFact> = (state, input) => then(fields(state, input, "RetentionFact", ["source","into"]), values =>
    then(producerIdentity(state, values[0]), sourceValue =>
    then(escapeTarget(state, values[1]), intoValue =>
      accept<RetentionFact>({ source: sourceValue, into: intoValue }))));
const suspensionValue: Decode<SuspensionValue> = (state, input) => then(fields(state, input, "SuspensionValue", ["place","origins","retention","continuations"]), values =>
    then(place(state, values[0]), placeValue =>
    then(originsIdentity(state, values[1]), originsValue =>
    then(sequence(state, values[2], retention), retentionValue =>
    then(sequence(state, values[3], (state, input) => literal(state, input, ["resume","return","unwind"])), continuationsValue =>
      accept<SuspensionValue>({ place: placeValue, origins: originsValue, retention: retentionValue, continuations: continuationsValue }))))));
const suspensionFact: Decode<SuspensionFact> = (state, input) => then(label(state, input, ["await","yield","delegate"]), kind =>
  then(fields(state, input, kind, ["node","values"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(sequence(state, values[1], suspensionValue), valuesValue =>
      accept<SuspensionFact>({ kind: kind, node: nodeValue, values: valuesValue })))));
const suspension: Decode<SuspensionFacts> = (state, input) => then(fields(state, input, "SuspensionFacts", ["suspensions"]), values =>
    then(sequence(state, values[0], suspensionFact), suspensionsValue =>
      accept<SuspensionFacts>({ suspensions: suspensionsValue })));
const errorStorageFact: Decode<ErrorStorageFact> = (state, input) => then(fields(state, input, "ErrorStorageFact", ["node","origins","writes","retention","invalidations"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(originsIdentity(state, values[1]), originsValue =>
    then(sequence(state, values[2], node), writesValue =>
    then(sequence(state, values[3], retention), retentionValue =>
    then(sequence(state, values[4], errorInvalidation), invalidationsValue =>
      accept<ErrorStorageFact>({ node: nodeValue, origins: originsValue, writes: writesValue, retention: retentionValue, invalidations: invalidationsValue })))))));
const errorStorage: Decode<ErrorStorageFacts> = (state, input) => then(fields(state, input, "ErrorStorageFacts", ["errors"]), values =>
    then(sequence(state, values[0], errorStorageFact), errorsValue =>
      accept<ErrorStorageFacts>({ errors: errorsValue })));
const pointerBackingProducer: Decode<PointerBackingProducer> = (state, input) => then(fields(state, input, "PointerBackingProducer", ["producer","operation"]), values =>
    then(bound(state, values[0]), producerValue =>
    then(pointerOperation(state, values[1]), operationValue =>
      accept<PointerBackingProducer>({ producer: producerValue, operation: operationValue }))));
const pointerBackingFact: Decode<PointerBackingFact> = (state, input) => then(fields(state, input, "PointerBackingFact", ["node","returned","origins","producers"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(scalarBoolean(state, values[1]), returnedValue =>
    then(originsIdentity(state, values[2]), originsValue =>
    then(sequence(state, values[3], pointerBackingProducer), producersValue =>
      accept<PointerBackingFact>({ node: nodeValue, returned: returnedValue, origins: originsValue, producers: producersValue }))))));
const pointerBacking: Decode<PointerBackingFacts> = (state, input) => then(fields(state, input, "PointerBackingFacts", ["pointers"]), values =>
    then(sequence(state, values[0], pointerBackingFact), pointersValue =>
      accept<PointerBackingFacts>({ pointers: pointersValue })));
const metadataKey: Decode<MetadataKey> = (state, input) => then(fields(state, input, "MetadataKey", ["definition","bindings"]), values =>
    then(definition(state, values[0]), definitionValue =>
    then(artifact(state, values[1]), bindingsValue =>
      accept<MetadataKey>({ definition: definitionValue, bindings: bindingsValue }))));
const layoutRef: Decode<MetadataLayoutRef> = (state, input) => then(fields(state, input, "MetadataLayoutRef", ["metadata","layout"]), values =>
    then(metadataKey(state, values[0]), metadataValue =>
    then(layout(state, values[1]), layoutValue =>
      accept<MetadataLayoutRef>({ metadata: metadataValue, layout: layoutValue }))));
const fieldRef: Decode<MetadataFieldRef> = (state, input) => then(fields(state, input, "MetadataFieldRef", ["metadata","field"]), values =>
    then(metadataKey(state, values[0]), metadataValue =>
    then(field(state, values[1]), fieldValue =>
      accept<MetadataFieldRef>({ metadata: metadataValue, field: fieldValue }))));
const memoryField: Decode<MemoryField> = (state, input) => then(fields(state, input, "MemoryField", ["id","occurrence","owner","selector","selection","member","primary","selectedDeclarations","value","layout","byteOffset","byteAlignment"]), values =>
    then(field(state, values[0]), idValue =>
    then(sourceRef(state, values[1]), occurrenceValue =>
    then(typeIdentity(state, values[2]), ownerValue =>
    then(sourceRef(state, values[3]), selectorValue =>
    then(sourceRef(state, values[4]), selectionValue =>
    then(memberSelection(state, values[5]), memberValue =>
    then(nullable(state, values[6], definition), primaryValue =>
    then(sequence(state, values[7], definition), selectedDeclarationsValue =>
    then(typeIdentity(state, values[8]), valueValue =>
    then(layout(state, values[9]), layoutValue =>
    then(scalarBigint(state, values[10]), byteOffsetValue =>
    then(scalarBigint(state, values[11]), byteAlignmentValue =>
      accept<MemoryField>({ id: idValue, occurrence: occurrenceValue, owner: ownerValue, selector: selectorValue, selection: selectionValue, member: memberValue, primary: primaryValue, selectedDeclarations: selectedDeclarationsValue, value: valueValue, layout: layoutValue, byteOffset: byteOffsetValue, byteAlignment: byteAlignmentValue }))))))))))))));
const observation: Decode<ObservationFact> = (state, input) => then(fields(state, input, "ObservationFact", ["node","operation","operand","layout","field","result","value","context","bindings"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(literal(state, values[1], ["size","alignment","stride","field-offset"]), operationValue =>
    then(nodeRef(state, values[2]), operandValue =>
    then(layoutRef(state, values[3]), layoutValue =>
    then(nullable(state, values[4], fieldRef), fieldValue =>
    then(typeIdentity(state, values[5]), resultValue =>
    then(scalarBigint(state, values[6]), valueValue =>
    then(contextIdentity(state, values[7]), contextValue =>
    then(bindings(state, values[8]), bindingsValue =>
      accept<ObservationFact>({ node: nodeValue, operation: operationValue, operand: operandValue, layout: layoutValue, field: fieldValue, result: resultValue, value: valueValue, context: contextValue, bindings: bindingsValue })))))))))));
const rawLocation: Decode<RawLocationFact> = (state, input) => then(fields(state, input, "RawLocationFact", ["node","operation","pointee","layout","context","bindings"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(literal(state, values[1], ["to-raw","reinterpret"]), operationValue =>
    then(typeIdentity(state, values[2]), pointeeValue =>
    then(layoutRef(state, values[3]), layoutValue =>
    then(contextIdentity(state, values[4]), contextValue =>
    then(bindings(state, values[5]), bindingsValue =>
      accept<RawLocationFact>({ node: nodeValue, operation: operationValue, pointee: pointeeValue, layout: layoutValue, context: contextValue, bindings: bindingsValue }))))))));
const fieldBinding: Decode<MemoryFieldBindingFact> = (state, input) => then(fields(state, input, "MemoryFieldBindingFact", ["node","result","owner","fieldExpression","field","pointer","pointee","context","bindings"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(typeIdentity(state, values[1]), resultValue =>
    then(typeIdentity(state, values[2]), ownerValue =>
    then(nodeRef(state, values[3]), fieldExpressionValue =>
    then(fieldRef(state, values[4]), fieldValue =>
    then(nodeRef(state, values[5]), pointerValue =>
    then(typeIdentity(state, values[6]), pointeeValue =>
    then(contextIdentity(state, values[7]), contextValue =>
    then(bindings(state, values[8]), bindingsValue =>
      accept<MemoryFieldBindingFact>({ node: nodeValue, result: resultValue, owner: ownerValue, fieldExpression: fieldExpressionValue, field: fieldValue, pointer: pointerValue, pointee: pointeeValue, context: contextValue, bindings: bindingsValue })))))))))));
const boundRecordField: Decode<BoundRecordField> = (state, input) => then(fields(state, input, "BoundRecordField", ["expression","binding"]), values =>
    then(nodeRef(state, values[0]), expressionValue =>
    then(node(state, values[1]), bindingValue =>
      accept<BoundRecordField>({ expression: expressionValue, binding: bindingValue }))));
const recordBinding: Decode<MemoryRecordBindingFact> = (state, input) => then(fields(state, input, "MemoryRecordBindingFact", ["node","result","layoutExpression","layout","context","bindings","fields"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(typeIdentity(state, values[1]), resultValue =>
    then(nodeRef(state, values[2]), layoutExpressionValue =>
    then(layoutRef(state, values[3]), layoutValue =>
    then(contextIdentity(state, values[4]), contextValue =>
    then(bindings(state, values[5]), bindingsValue =>
    then(sequence(state, values[6], boundRecordField), fieldsValue =>
      accept<MemoryRecordBindingFact>({ node: nodeValue, result: resultValue, layoutExpression: layoutExpressionValue, layout: layoutValue, context: contextValue, bindings: bindingsValue, fields: fieldsValue })))))))));
const bodyFacts: Decode<BodyFacts> = (state, input) => then(fields(state, input, "BodyFacts", ["instance","arena","liveness","initialization","refinements","origins","suspension","errorStorage","pointerBacking","observations","rawLocations","fieldBindings","recordBindings","memoryBindings","selectedMemoryDeclarations","closedArrays"]), values =>
    then(bodyInstance(state, values[0]), instanceValue =>
    then(arena(state, values[1]), arenaValue =>
    then(liveness(state, values[2]), livenessValue =>
    then(initialization(state, values[3]), initializationValue =>
    then(refinements(state, values[4]), refinementsValue =>
    then(originFacts(state, values[5]), originsValue =>
    then(suspension(state, values[6]), suspensionValue =>
    then(errorStorage(state, values[7]), errorStorageValue =>
    then(pointerBacking(state, values[8]), pointerBackingValue =>
    then(sequence(state, values[9], observation), observationsValue =>
    then(sequence(state, values[10], rawLocation), rawLocationsValue =>
    then(sequence(state, values[11], fieldBinding), fieldBindingsValue =>
    then(sequence(state, values[12], recordBinding), recordBindingsValue =>
    then(sequence(state, values[13], memoryInventory), memoryBindingsValue =>
    then(sequence(state, values[14], definition), selectedMemoryDeclarationsValue =>
    then(sequence(state, values[15], closedArray), closedArraysValue =>
      accept<BodyFacts>({ instance: instanceValue, arena: arenaValue, liveness: livenessValue, initialization: initializationValue, refinements: refinementsValue, origins: originsValue, suspension: suspensionValue, errorStorage: errorStorageValue, pointerBacking: pointerBackingValue, observations: observationsValue, rawLocations: rawLocationsValue, fieldBindings: fieldBindingsValue, recordBindings: recordBindingsValue, memoryBindings: memoryBindingsValue, selectedMemoryDeclarations: selectedMemoryDeclarationsValue, closedArrays: closedArraysValue }))))))))))))))))));
const parameterEffect: Decode<ParameterEffect> = (state, input) => then(fields(state, input, "ParameterEffect", ["slot","reads","writes"]), values =>
    then(parameterSlot(state, values[0]), slotValue =>
    then(effectPaths(state, values[1]), readsValue =>
    then(effectPaths(state, values[2]), writesValue =>
      accept<ParameterEffect>({ slot: slotValue, reads: readsValue, writes: writesValue })))));
const captureEffect: Decode<CaptureEffect> = (state, input) => then(fields(state, input, "CaptureEffect", ["index","reads","writes"]), values =>
    then(scalarNumber(state, values[0]), indexValue =>
    then(effectPaths(state, values[1]), readsValue =>
    then(effectPaths(state, values[2]), writesValue =>
      accept<CaptureEffect>({ index: indexValue, reads: readsValue, writes: writesValue })))));
const summaryWrite: Decode<SummaryWrite> = (state, input) => then(fields(state, input, "SummaryWrite", ["target","value"]), values =>
    then(producerIdentity(state, values[0]), targetValue =>
    then(originsIdentity(state, values[1]), valueValue =>
      accept<SummaryWrite>({ target: targetValue, value: valueValue }))));
const summaryCallback: Decode<SummaryCallback> = (state, input) => then(fields(state, input, "SummaryCallback", ["parameterIndex","timing","rejection","inputs"]), values =>
    then(scalarNumber(state, values[0]), parameterIndexValue =>
    then(literal(state, values[1], ["synchronous","deferred"]), timingValue =>
    then(nullable(state, values[2], scalarNumber), rejectionValue =>
    then(sequence(state, values[3], callbackInput), inputsValue =>
      accept<SummaryCallback>({ parameterIndex: parameterIndexValue, timing: timingValue, rejection: rejectionValue, inputs: inputsValue }))))));
const summary: Decode<Summary> = (state, input) => then(fields(state, input, "Summary", ["key","signature","arena","parameters","captures","result","thrown","writes","retention","callbacks","invocationOnlyParameters","suspends","bindingDependent"]), values =>
    then(summaryKey(state, values[0]), keyValue =>
    then(signature(state, values[1]), signatureValue =>
    then(arena(state, values[2]), arenaValue =>
    then(sequence(state, values[3], parameterEffect), parametersValue =>
    then(sequence(state, values[4], captureEffect), capturesValue =>
    then(originsIdentity(state, values[5]), resultValue =>
    then(originsIdentity(state, values[6]), thrownValue =>
    then(sequence(state, values[7], summaryWrite), writesValue =>
    then(sequence(state, values[8], retention), retentionValue =>
    then(sequence(state, values[9], summaryCallback), callbacksValue =>
    then(sequence(state, values[10], scalarNumber), invocationOnlyParametersValue =>
    then(scalarBoolean(state, values[11]), suspendsValue =>
    then(scalarBoolean(state, values[12]), bindingDependentValue =>
      accept<Summary>({ key: keyValue, signature: signatureValue, arena: arenaValue, parameters: parametersValue, captures: capturesValue, result: resultValue, thrown: thrownValue, writes: writesValue, retention: retentionValue, callbacks: callbacksValue, invocationOnlyParameters: invocationOnlyParametersValue, suspends: suspendsValue, bindingDependent: bindingDependentValue })))))))))))))));
const callComponent: Decode<CallComponent> = (state, input) => then(fields(state, input, "CallComponent", ["id","definitions","dependencies"]), values =>
    then(component(state, values[0]), idValue =>
    then(sequence(state, values[1], definition), definitionsValue =>
    then(sequence(state, values[2], component), dependenciesValue =>
      accept<CallComponent>({ id: idValue, definitions: definitionsValue, dependencies: dependenciesValue })))));
const callEdge: Decode<CallEdge> = (state, input) => then(label(state, input, ["direct","indirect","getter","setter","constructor","initializer","callback"]), kind =>
  then(fields(state, input, kind, ["caller","at","callee","bindings"]), values =>
    then(definition(state, values[0]), callerValue =>
    then(nodeRef(state, values[1]), atValue =>
    then(callCallee(state, values[2]), calleeValue =>
    then(artifact(state, values[3]), bindingsValue =>
      accept<CallEdge>({ kind: kind, caller: callerValue, at: atValue, callee: calleeValue, bindings: bindingsValue })))))));
const callGraph: Decode<CallGraph> = (state, input) => then(fields(state, input, "CallGraph", ["definitions","edges","components"]), values =>
    then(sequence(state, values[0], definition), definitionsValue =>
    then(sequence(state, values[1], callEdge), edgesValue =>
    then(sequence(state, values[2], callComponent), componentsValue =>
      accept<CallGraph>({ definitions: definitionsValue, edges: edgesValue, components: componentsValue })))));
const itemRef: Decode<ItemNodeRef> = (state, input) => then(fields(state, input, "ItemNodeRef", ["owner","node"]), values =>
    then(definition(state, values[0]), ownerValue =>
    then(node(state, values[1]), nodeValue =>
      accept<ItemNodeRef>({ owner: ownerValue, node: nodeValue }))));
const sourceRef: Decode<SourceNodeRef> = (state, input) => then(label(state, input, ["body","item"]), kind => {
  switch (kind) {
    case "body": return then(fields(state, input, "body", ["value"]), values =>
    then(nodeRef(state, values[0]), valueValue =>
      accept<SourceNodeRef>({ kind: "body", value: valueValue })));
    case "item": return then(fields(state, input, "item", ["value"]), values =>
    then(itemRef(state, values[0]), valueValue =>
      accept<SourceNodeRef>({ kind: "item", value: valueValue })));
  }
});
const typeBinding: Decode<TypeBinding> = (state, input) => then(label(state, input, ["bound","rigid"]), kind => {
  switch (kind) {
    case "bound": return then(fields(state, input, "bound", ["parameter","type"]), values =>
    then(parameterIdentity(state, values[0]), parameterValue =>
    then(typeIdentity(state, values[1]), typeValue =>
      accept<TypeBinding>({ kind: "bound", parameter: parameterValue, type: typeValue }))));
    case "rigid": return then(fields(state, input, "rigid", ["parameter"]), values =>
    then(parameterIdentity(state, values[0]), parameterValue =>
      accept<TypeBinding>({ kind: "rigid", parameter: parameterValue })));
  }
});
const selfBinding: Decode<SelfBinding> = (state, input) => then(label(state, input, ["bound","rigid"]), kind => {
  switch (kind) {
    case "bound": return then(fields(state, input, "bound", ["owner","type"]), values =>
    then(definition(state, values[0]), ownerValue =>
    then(typeIdentity(state, values[1]), typeValue =>
      accept<SelfBinding>({ kind: "bound", owner: ownerValue, type: typeValue }))));
    case "rigid": return then(fields(state, input, "rigid", ["owner"]), values =>
    then(definition(state, values[0]), ownerValue =>
      accept<SelfBinding>({ kind: "rigid", owner: ownerValue })));
  }
});
const artifact: Decode<ArtifactBindings> = (state, input) => then(label(state, input, ["parametric","instantiated"]), kind => {
  switch (kind) {
    case "parametric": return then(fields(state, input, "parametric", []), values =>
      accept<ArtifactBindings>({ kind: "parametric" }));
    case "instantiated": return then(fields(state, input, "instantiated", ["bindings"]), values =>
    then(bindings(state, values[0]), bindingsValue =>
      accept<ArtifactBindings>({ kind: "instantiated", bindings: bindingsValue })));
  }
});
const memberKey: Decode<MemberKey> = (state, input) => then(label(state, input, ["text","number","symbol"]), kind => {
  switch (kind) {
    case "text": return then(fields(state, input, "text", ["value"]), values =>
    then(scalarString(state, values[0]), valueValue =>
      accept<MemberKey>({ kind: "text", value: valueValue })));
    case "number": return then(fields(state, input, "number", ["value"]), values =>
    then(rational(state, values[0]), valueValue =>
      accept<MemberKey>({ kind: "number", value: valueValue })));
    case "symbol": return then(fields(state, input, "symbol", ["declaration"]), values =>
    then(definition(state, values[0]), declarationValue =>
      accept<MemberKey>({ kind: "symbol", declaration: declarationValue })));
  }
});
const memberOrigin: Decode<MemberOrigin> = (state, input) => then(label(state, input, ["declared","class-prototype","mapped"]), kind => {
  switch (kind) {
    case "declared": return then(fields(state, input, "declared", ["declaration"]), values =>
    then(definition(state, values[0]), declarationValue =>
      accept<MemberOrigin>({ kind: "declared", declaration: declarationValue })));
    case "class-prototype": return then(fields(state, input, "class-prototype", ["owner"]), values =>
    then(definition(state, values[0]), ownerValue =>
      accept<MemberOrigin>({ kind: "class-prototype", owner: ownerValue })));
    case "mapped": return then(fields(state, input, "mapped", ["owner","key"]), values =>
    then(sourceRef(state, values[0]), ownerValue =>
    then(memberKey(state, values[1]), keyValue =>
      accept<MemberOrigin>({ kind: "mapped", owner: ownerValue, key: keyValue }))));
  }
});
const owner: Decode<RelationalOwner> = (state, input) => then(label(state, input, ["body","summary"]), kind => {
  switch (kind) {
    case "body": return then(fields(state, input, "body", ["instance"]), values =>
    then(bodyInstance(state, values[0]), instanceValue =>
      accept<RelationalOwner>({ kind: "body", instance: instanceValue })));
    case "summary": return then(fields(state, input, "summary", ["definition","bindings"]), values =>
    then(definition(state, values[0]), definitionValue =>
    then(artifact(state, values[1]), bindingsValue =>
      accept<RelationalOwner>({ kind: "summary", definition: definitionValue, bindings: bindingsValue }))));
  }
});
const site: Decode<RelationalSite> = (state, input) => then(label(state, input, ["node","declared"]), kind => {
  switch (kind) {
    case "node": return then(fields(state, input, "node", ["node"]), values =>
    then(nodeRef(state, values[0]), nodeValue =>
      accept<RelationalSite>({ kind: "node", node: nodeValue })));
    case "declared": return then(fields(state, input, "declared", ["identity","site"]), values =>
    then(libraryExport(state, values[0]), identityValue =>
    then(scalarNumber(state, values[1]), siteValue =>
      accept<RelationalSite>({ kind: "declared", identity: identityValue, site: siteValue }))));
  }
});
const projection: Decode<Projection> = (state, input) => then(label(state, input, ["field","method-value","element","index","deref"]), kind => {
  switch (kind) {
    case "field": return then(fields(state, input, "field", ["member"]), values =>
    then(memberSelection(state, values[0]), memberValue =>
      accept<Projection>({ kind: "field", member: memberValue })));
    case "method-value": return then(fields(state, input, "method-value", ["member"]), values =>
    then(memberSelection(state, values[0]), memberValue =>
      accept<Projection>({ kind: "method-value", member: memberValue })));
    case "element": return then(fields(state, input, "element", []), values =>
      accept<Projection>({ kind: "element" }));
    case "index": return then(fields(state, input, "index", ["constant"]), values =>
    then(scalarBigint(state, values[0]), constantValue =>
      accept<Projection>({ kind: "index", constant: constantValue })));
    case "deref": return then(fields(state, input, "deref", []), values =>
      accept<Projection>({ kind: "deref" }));
  }
});
const producer: Decode<Producer> = (state, input) => then(label(state, input, ["allocation","parameter","receiver","capture","shared","suspension-input","call-result"]), kind => {
  switch (kind) {
    case "allocation": return then(fields(state, input, "allocation", ["id","path","at"]), values =>
    then(producerIdentity(state, values[0]), idValue =>
    then(nullable(state, values[1], path), pathValue =>
    then(site(state, values[2]), atValue =>
      accept<Producer>({ kind: "allocation", id: idValue, path: pathValue, at: atValue })))));
    case "parameter": return then(fields(state, input, "parameter", ["id","path","index"]), values =>
    then(producerIdentity(state, values[0]), idValue =>
    then(nullable(state, values[1], path), pathValue =>
    then(scalarNumber(state, values[2]), indexValue =>
      accept<Producer>({ kind: "parameter", id: idValue, path: pathValue, index: indexValue })))));
    case "receiver": return then(fields(state, input, "receiver", ["id","path"]), values =>
    then(producerIdentity(state, values[0]), idValue =>
    then(nullable(state, values[1], path), pathValue =>
      accept<Producer>({ kind: "receiver", id: idValue, path: pathValue }))));
    case "capture": return then(fields(state, input, "capture", ["id","path","index"]), values =>
    then(producerIdentity(state, values[0]), idValue =>
    then(nullable(state, values[1], path), pathValue =>
    then(scalarNumber(state, values[2]), indexValue =>
      accept<Producer>({ kind: "capture", id: idValue, path: pathValue, index: indexValue })))));
    case "shared": return then(fields(state, input, "shared", ["id","path","definition"]), values =>
    then(producerIdentity(state, values[0]), idValue =>
    then(nullable(state, values[1], path), pathValue =>
    then(definition(state, values[2]), definitionValue =>
      accept<Producer>({ kind: "shared", id: idValue, path: pathValue, definition: definitionValue })))));
    case "suspension-input": return then(fields(state, input, "suspension-input", ["id","path","at","channel"]), values =>
    then(producerIdentity(state, values[0]), idValue =>
    then(nullable(state, values[1], path), pathValue =>
    then(nodeRef(state, values[2]), atValue =>
    then(literal(state, values[3], ["sent","return","thrown"]), channelValue =>
      accept<Producer>({ kind: "suspension-input", id: idValue, path: pathValue, at: atValue, channel: channelValue }))))));
    case "call-result": return then(fields(state, input, "call-result", ["id","path","at","callee"]), values =>
    then(producerIdentity(state, values[0]), idValue =>
    then(nullable(state, values[1], path), pathValue =>
    then(nodeRef(state, values[2]), atValue =>
    then(producerCallee(state, values[3]), calleeValue =>
      accept<Producer>({ kind: "call-result", id: idValue, path: pathValue, at: atValue, callee: calleeValue }))))));
  }
});
const producerCallee: Decode<Extract<Producer, { readonly kind: "call-result" }>["callee"]> = (state, input) => then(label(state, input, ["direct","indirect"]), kind => {
  switch (kind) {
    case "direct": return then(fields(state, input, "direct", ["definition"]), values =>
    then(definition(state, values[0]), definitionValue =>
      accept<Extract<Producer, { readonly kind: "call-result" }>["callee"]>({ kind: "direct", definition: definitionValue })));
    case "indirect": return then(fields(state, input, "indirect", []), values =>
      accept<Extract<Producer, { readonly kind: "call-result" }>["callee"]>({ kind: "indirect" }));
  }
});
const origins: Decode<Origins> = (state, input) => then(label(state, input, ["complete","open"]), kind => {
  switch (kind) {
    case "complete": return then(fields(state, input, "complete", ["id","producers","includesAbsence"]), values =>
    then(originsIdentity(state, values[0]), idValue =>
    then(sequence(state, values[1], bound), producersValue =>
    then(scalarBoolean(state, values[2]), includesAbsenceValue =>
      accept<Origins>({ kind: "complete", id: idValue, producers: producersValue, includesAbsence: includesAbsenceValue })))));
    case "open": return then(fields(state, input, "open", ["id","producers","includesAbsence","boundaries"]), values =>
    then(originsIdentity(state, values[0]), idValue =>
    then(sequence(state, values[1], bound), producersValue =>
    then(scalarBoolean(state, values[2]), includesAbsenceValue =>
    then(nonempty(state, values[3], boundary), boundariesValue =>
      accept<Origins>({ kind: "open", id: idValue, producers: producersValue, includesAbsence: includesAbsenceValue, boundaries: boundariesValue }))))));
  }
});
const refinementReason: Decode<RefinementReason> = (state, input) => then(label(state, input, ["invalidated","guard-not-proven"]), kind => {
  switch (kind) {
    case "invalidated": return then(fields(state, input, "invalidated", ["sites"]), values =>
    then(nonempty(state, values[0], refinementInvalidation), sitesValue =>
      accept<RefinementReason>({ kind: "invalidated", sites: sitesValue })));
    case "guard-not-proven": return then(fields(state, input, "guard-not-proven", ["detail"]), values =>
    then(scalarString(state, values[0]), detailValue =>
      accept<RefinementReason>({ kind: "guard-not-proven", detail: detailValue })));
  }
});
const refinementFact: Decode<RefinementFact> = (state, input) => then(label(state, input, ["proven","unproven"]), kind => {
  switch (kind) {
    case "proven": return then(fields(state, input, "proven", ["node","guards"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(sequence(state, values[1], node), guardsValue =>
      accept<RefinementFact>({ kind: "proven", node: nodeValue, guards: guardsValue }))));
    case "unproven": return then(fields(state, input, "unproven", ["node","guards","reason"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(sequence(state, values[1], node), guardsValue =>
    then(refinementReason(state, values[2]), reasonValue =>
      accept<RefinementFact>({ kind: "unproven", node: nodeValue, guards: guardsValue, reason: reasonValue })))));
  }
});
const escapeTarget: Decode<EscapeTarget> = (state, input) => then(label(state, input, ["return","throw","shared","parameter","receiver","capture","callback","suspension","external"]), kind => {
  switch (kind) {
    case "return": return then(fields(state, input, "return", []), values =>
      accept<EscapeTarget>({ kind: "return" }));
    case "throw": return then(fields(state, input, "throw", []), values =>
      accept<EscapeTarget>({ kind: "throw" }));
    case "shared": return then(fields(state, input, "shared", ["definition","path"]), values =>
    then(definition(state, values[0]), definitionValue =>
    then(nullable(state, values[1], path), pathValue =>
      accept<EscapeTarget>({ kind: "shared", definition: definitionValue, path: pathValue }))));
    case "parameter": return then(fields(state, input, "parameter", ["index","path"]), values =>
    then(scalarNumber(state, values[0]), indexValue =>
    then(nullable(state, values[1], path), pathValue =>
      accept<EscapeTarget>({ kind: "parameter", index: indexValue, path: pathValue }))));
    case "receiver": return then(fields(state, input, "receiver", ["path"]), values =>
    then(nullable(state, values[0], path), pathValue =>
      accept<EscapeTarget>({ kind: "receiver", path: pathValue })));
    case "capture": return then(fields(state, input, "capture", ["index","path"]), values =>
    then(scalarNumber(state, values[0]), indexValue =>
    then(nullable(state, values[1], path), pathValue =>
      accept<EscapeTarget>({ kind: "capture", index: indexValue, path: pathValue }))));
    case "callback": return then(fields(state, input, "callback", ["at"]), values =>
    then(site(state, values[0]), atValue =>
      accept<EscapeTarget>({ kind: "callback", at: atValue })));
    case "suspension": return then(fields(state, input, "suspension", ["at"]), values =>
    then(site(state, values[0]), atValue =>
      accept<EscapeTarget>({ kind: "suspension", at: atValue })));
    case "external": return then(fields(state, input, "external", ["boundary"]), values =>
    then(boundary(state, values[0]), boundaryValue =>
      accept<EscapeTarget>({ kind: "external", boundary: boundaryValue })));
  }
});
const callbackInput: Decode<CallbackInput> = (state, input) => then(label(state, input, ["receiver-element","receiver-rejection","argument-element"]), kind => {
  switch (kind) {
    case "receiver-element": return then(fields(state, input, "receiver-element", ["parameterIndex"]), values =>
    then(scalarNumber(state, values[0]), parameterIndexValue =>
      accept<CallbackInput>({ kind: "receiver-element", parameterIndex: parameterIndexValue })));
    case "receiver-rejection": return then(fields(state, input, "receiver-rejection", ["parameterIndex"]), values =>
    then(scalarNumber(state, values[0]), parameterIndexValue =>
      accept<CallbackInput>({ kind: "receiver-rejection", parameterIndex: parameterIndexValue })));
    case "argument-element": return then(fields(state, input, "argument-element", ["parameterIndex","sourceParameterIndex"]), values =>
    then(scalarNumber(state, values[0]), parameterIndexValue =>
    then(scalarNumber(state, values[1]), sourceParameterIndexValue =>
      accept<CallbackInput>({ kind: "argument-element", parameterIndex: parameterIndexValue, sourceParameterIndex: sourceParameterIndexValue }))));
  }
});
const errorReason: Decode<ErrorInvalidationReason> = (state, input) => then(label(state, input, ["incomplete-origins","inexact-accessor-footprint","open-constructor-domain","opaque-invocation-footprint"]), kind => {
  switch (kind) {
    case "incomplete-origins": return then(fields(state, input, "incomplete-origins", ["affected"]), values =>
    then(originsIdentity(state, values[0]), affectedValue =>
      accept<ErrorInvalidationReason>({ kind: "incomplete-origins", affected: affectedValue })));
    case "inexact-accessor-footprint": return then(fields(state, input, "inexact-accessor-footprint", []), values =>
      accept<ErrorInvalidationReason>({ kind: "inexact-accessor-footprint" }));
    case "open-constructor-domain": return then(fields(state, input, "open-constructor-domain", ["constructor"]), values =>
    then(originsIdentity(state, values[0]), constructorValue =>
      accept<ErrorInvalidationReason>({ kind: "open-constructor-domain", constructor: constructorValue })));
    case "opaque-invocation-footprint": return then(fields(state, input, "opaque-invocation-footprint", ["affected"]), values =>
    then(originsIdentity(state, values[0]), affectedValue =>
      accept<ErrorInvalidationReason>({ kind: "opaque-invocation-footprint", affected: affectedValue })));
  }
});
const memoryLayout: Decode<MemoryLayout> = (state, input) => then(label(state, input, ["value","array"]), kind => {
  switch (kind) {
    case "value": return then(fields(state, input, "value", ["id","occurrence","source","dataLayout","byteSize","byteAlignment","stride","fields"]), values =>
    then(layout(state, values[0]), idValue =>
    then(sourceRef(state, values[1]), occurrenceValue =>
    then(typeIdentity(state, values[2]), sourceValue =>
    then(definition(state, values[3]), dataLayoutValue =>
    then(scalarBigint(state, values[4]), byteSizeValue =>
    then(scalarBigint(state, values[5]), byteAlignmentValue =>
    then(scalarBigint(state, values[6]), strideValue =>
    then(sequence(state, values[7], field), fieldsValue =>
      accept<MemoryLayout>({ kind: "value", id: idValue, occurrence: occurrenceValue, source: sourceValue, dataLayout: dataLayoutValue, byteSize: byteSizeValue, byteAlignment: byteAlignmentValue, stride: strideValue, fields: fieldsValue }))))))))));
    case "array": return then(fields(state, input, "array", ["id","occurrence","source","dataLayout","byteSize","byteAlignment","stride","length","runtimeBase","element"]), values =>
    then(layout(state, values[0]), idValue =>
    then(sourceRef(state, values[1]), occurrenceValue =>
    then(typeIdentity(state, values[2]), sourceValue =>
    then(definition(state, values[3]), dataLayoutValue =>
    then(scalarBigint(state, values[4]), byteSizeValue =>
    then(scalarBigint(state, values[5]), byteAlignmentValue =>
    then(scalarBigint(state, values[6]), strideValue =>
    then(scalarBigint(state, values[7]), lengthValue =>
    then(literal(state, values[8], ["number","bigint"]), runtimeBaseValue =>
    then(layout(state, values[9]), elementValue =>
      accept<MemoryLayout>({ kind: "array", id: idValue, occurrence: occurrenceValue, source: sourceValue, dataLayout: dataLayoutValue, byteSize: byteSizeValue, byteAlignment: byteAlignmentValue, stride: strideValue, length: lengthValue, runtimeBase: runtimeBaseValue, element: elementValue }))))))))))));
  }
});
const metadata: Decode<MetadataRecord> = (state, input) => then(label(state, input, ["data-layout","memory-layout","memory-field"]), kind => {
  switch (kind) {
    case "data-layout": return then(fields(state, input, "data-layout", ["key","occurrence","fingerprint","byteOrder","addressWidth"]), values =>
    then(metadataKey(state, values[0]), keyValue =>
    then(sourceRef(state, values[1]), occurrenceValue =>
    then(scalarString(state, values[2]), fingerprintValue =>
    then(literal(state, values[3], ["little","big"]), byteOrderValue =>
    then(literal(state, values[4], [32, 64]), addressWidthValue =>
      accept<MetadataRecord>({ kind: "data-layout", key: keyValue, occurrence: occurrenceValue, fingerprint: fingerprintValue, byteOrder: byteOrderValue, addressWidth: addressWidthValue })))))));
    case "memory-layout": return then(fields(state, input, "memory-layout", ["key","root","layouts","fields"]), values =>
    then(metadataKey(state, values[0]), keyValue =>
    then(layout(state, values[1]), rootValue =>
    then(sequence(state, values[2], memoryLayout), layoutsValue =>
    then(sequence(state, values[3], memoryField), fieldsValue =>
      accept<MetadataRecord>({ kind: "memory-layout", key: keyValue, root: rootValue, layouts: layoutsValue, fields: fieldsValue }))))));
    case "memory-field": return then(fields(state, input, "memory-field", ["key","root","layouts","fields"]), values =>
    then(metadataKey(state, values[0]), keyValue =>
    then(field(state, values[1]), rootValue =>
    then(sequence(state, values[2], memoryLayout), layoutsValue =>
    then(sequence(state, values[3], memoryField), fieldsValue =>
      accept<MetadataRecord>({ kind: "memory-field", key: keyValue, root: rootValue, layouts: layoutsValue, fields: fieldsValue }))))));
  }
});
const memoryInventory: Decode<MemoryBindingInventoryEntry> = (state, input) => then(label(state, input, ["bound","error"]), kind => {
  switch (kind) {
    case "bound": return then(fields(state, input, "bound", ["node","record"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(node(state, values[1]), recordValue =>
      accept<MemoryBindingInventoryEntry>({ kind: "bound", node: nodeValue, record: recordValue }))));
    case "error": return then(fields(state, input, "error", ["node"]), values =>
    then(node(state, values[0]), nodeValue =>
      accept<MemoryBindingInventoryEntry>({ kind: "error", node: nodeValue })));
  }
});
const closedReason: Decode<ClosedArrayReason> = (state, input) => then(label(state, input, ["not-local-element-access","open-origin-domain","nonlocal-or-projected-origin","sparse-or-spread-literal","callable-boundary","alias-declaration-missing","different-origin-domain","binding-not-plain","initialization-not-block-local","unproven-capture","assignment-result-exposed","unproven-use","no-local-allocation"]), kind => {
  switch (kind) {
    case "not-local-element-access": return then(fields(state, input, "not-local-element-access", ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<ClosedArrayReason>({ kind: "not-local-element-access", at: atValue })));
    case "open-origin-domain": return then(fields(state, input, "open-origin-domain", ["origins"]), values =>
    then(originsIdentity(state, values[0]), originsValue =>
      accept<ClosedArrayReason>({ kind: "open-origin-domain", origins: originsValue })));
    case "nonlocal-or-projected-origin": return then(fields(state, input, "nonlocal-or-projected-origin", ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<ClosedArrayReason>({ kind: "nonlocal-or-projected-origin", at: atValue })));
    case "sparse-or-spread-literal": return then(fields(state, input, "sparse-or-spread-literal", ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<ClosedArrayReason>({ kind: "sparse-or-spread-literal", at: atValue })));
    case "callable-boundary": return then(fields(state, input, "callable-boundary", ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<ClosedArrayReason>({ kind: "callable-boundary", at: atValue })));
    case "alias-declaration-missing": return then(fields(state, input, "alias-declaration-missing", ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<ClosedArrayReason>({ kind: "alias-declaration-missing", at: atValue })));
    case "different-origin-domain": return then(fields(state, input, "different-origin-domain", ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<ClosedArrayReason>({ kind: "different-origin-domain", at: atValue })));
    case "binding-not-plain": return then(fields(state, input, "binding-not-plain", ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<ClosedArrayReason>({ kind: "binding-not-plain", at: atValue })));
    case "initialization-not-block-local": return then(fields(state, input, "initialization-not-block-local", ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<ClosedArrayReason>({ kind: "initialization-not-block-local", at: atValue })));
    case "unproven-capture": return then(fields(state, input, "unproven-capture", ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<ClosedArrayReason>({ kind: "unproven-capture", at: atValue })));
    case "assignment-result-exposed": return then(fields(state, input, "assignment-result-exposed", ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<ClosedArrayReason>({ kind: "assignment-result-exposed", at: atValue })));
    case "unproven-use": return then(fields(state, input, "unproven-use", ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<ClosedArrayReason>({ kind: "unproven-use", at: atValue })));
    case "no-local-allocation": return then(fields(state, input, "no-local-allocation", ["at"]), values =>
    then(nodeRef(state, values[0]), atValue =>
      accept<ClosedArrayReason>({ kind: "no-local-allocation", at: atValue })));
  }
});
const closedArray: Decode<ClosedArrayFact> = (state, input) => then(label(state, input, ["unproven","closed"]), kind => {
  switch (kind) {
    case "unproven": return then(fields(state, input, "unproven", ["node","reason"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(closedReason(state, values[1]), reasonValue =>
      accept<ClosedArrayFact>({ kind: "unproven", node: nodeValue, reason: reasonValue }))));
    case "closed": return then(fields(state, input, "closed", ["node","declarations","references","literals","elements"]), values =>
    then(node(state, values[0]), nodeValue =>
    then(sequence(state, values[1], definition), declarationsValue =>
    then(sequence(state, values[2], nodeRef), referencesValue =>
    then(sequence(state, values[3], nodeRef), literalsValue =>
    then(sequence(state, values[4], memberSelection), elementsValue =>
      accept<ClosedArrayFact>({ kind: "closed", node: nodeValue, declarations: declarationsValue, references: referencesValue, literals: literalsValue, elements: elementsValue })))))));
  }
});
const effectPaths: Decode<EffectPaths> = (state, input) => then(label(state, input, ["complete","open"]), kind => {
  switch (kind) {
    case "complete": return then(fields(state, input, "complete", ["paths"]), values =>
    then(sequence(state, values[0], path), pathsValue =>
      accept<EffectPaths>({ kind: "complete", paths: pathsValue })));
    case "open": return then(fields(state, input, "open", ["paths","boundaries"]), values =>
    then(sequence(state, values[0], path), pathsValue =>
    then(nonempty(state, values[1], boundary), boundariesValue =>
      accept<EffectPaths>({ kind: "open", paths: pathsValue, boundaries: boundariesValue }))));
  }
});
const parameterSlot: Decode<ParameterSlot> = (state, input) => then(label(state, input, ["receiver","parameter"]), kind => {
  switch (kind) {
    case "receiver": return then(fields(state, input, "receiver", []), values =>
      accept<ParameterSlot>({ kind: "receiver" }));
    case "parameter": return then(fields(state, input, "parameter", ["index"]), values =>
    then(scalarNumber(state, values[0]), indexValue =>
      accept<ParameterSlot>({ kind: "parameter", index: indexValue })));
  }
});
const callCallee: Decode<CallEdge["callee"]> = (state, input) => then(label(state, input, ["definition","open"]), kind => {
  switch (kind) {
    case "definition": return then(fields(state, input, "definition", ["definition"]), values =>
    then(definition(state, values[0]), definitionValue =>
      accept<CallEdge["callee"]>({ kind: "definition", definition: definitionValue })));
    case "open": return then(fields(state, input, "open", ["boundary"]), values =>
    then(boundaryRef(state, values[0]), boundaryValue =>
      accept<CallEdge["callee"]>({ kind: "open", boundary: boundaryValue })));
  }
});
const parameterMapping: Decode<ParameterMapping> = (state, input) => then(label(state, input, ["argument","default","omitted","rest"]), kind => {
  switch (kind) {
    case "argument": return then(fields(state, input, "argument", ["parameter","argument","component","passing"]), values =>
    then(scalarNumber(state, values[0]), parameterValue =>
    then(scalarNumber(state, values[1]), argumentValue =>
    then(nullable(state, values[2], scalarNumber), componentValue =>
    then(literal(state, values[3], ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]), passingValue =>
      accept<ParameterMapping>({ kind: "argument", parameter: parameterValue, argument: argumentValue, component: componentValue, passing: passingValue }))))));
    case "default": return then(fields(state, input, "default", ["parameter","initializer"]), values =>
    then(scalarNumber(state, values[0]), parameterValue =>
    then(body(state, values[1]), initializerValue =>
      accept<ParameterMapping>({ kind: "default", parameter: parameterValue, initializer: initializerValue }))));
    case "omitted": return then(fields(state, input, "omitted", ["parameter","type"]), values =>
    then(scalarNumber(state, values[0]), parameterValue =>
    then(typeIdentity(state, values[1]), typeValue =>
      accept<ParameterMapping>({ kind: "omitted", parameter: parameterValue, type: typeValue }))));
    case "rest": return then(fields(state, input, "rest", ["parameter","arguments","passing"]), values =>
    then(scalarNumber(state, values[0]), parameterValue =>
    then(sequence(state, values[1], scalarNumber), argumentsValue =>
    then(literal(state, values[2], ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]), passingValue =>
      accept<ParameterMapping>({ kind: "rest", parameter: parameterValue, arguments: argumentsValue, passing: passingValue })))));
  }
});

const pointerOperation: Decode<PointerBackingOperation> = (state, input) =>
  then(fields(state, input, "PointerBackingOperation", ["family", "operation", "at"]), values =>
    then(literal(state, values[0], ["typed-location", "raw-memory"]), family =>
      then(nodeRef(state, values[2]), at => family === "raw-memory"
        ? then(literal(state, values[1], ["reinterpret"]), operation => accept<PointerBackingOperation>({ family, operation, at }))
        : then(literal(state, values[1], ["allocate", "address-of", "bind-pointer", "project-pointer"]),
          operation => accept<PointerBackingOperation>({ family, operation, at })))));
const errorInvalidation: Decode<ErrorInvalidationFact> = (state, input) =>
  then(label(state, input, ["preserved", "invalidated", "unproven"]), kind => {
    switch (kind) {
      case "preserved": return then(fields(state, input, "preserved", ["at","owner"]), values =>
    then(nodeRef(state, values[0]), atValue =>
    then(originsIdentity(state, values[1]), ownerValue =>
      accept<ErrorInvalidationFact>({ kind: "preserved", at: atValue, owner: ownerValue }))));
      case "unproven": return then(fields(state, input, "unproven", ["at","owner","reason","detail"]), values =>
    then(nodeRef(state, values[0]), atValue =>
    then(originsIdentity(state, values[1]), ownerValue =>
    then(errorReason(state, values[2]), reasonValue =>
    then(scalarString(state, values[3]), detailValue =>
      accept<ErrorInvalidationFact>({ kind: "unproven", at: atValue, owner: ownerValue, reason: reasonValue, detail: detailValue }))))));
      case "invalidated": {
        const causeInput = input?.kind === "record" ? input.fields[2]?.value : undefined;
        return then(literal(state, causeInput, ["suspension", "overlapping-write"]), cause => cause === "suspension"
          ? then(fields(state, input, "invalidated", ["at","owner","cause"]), values =>
    then(nodeRef(state, values[0]), atValue =>
    then(originsIdentity(state, values[1]), ownerValue =>
    then(literal(state, values[2], ["suspension"]), causeValue =>
      accept<ErrorInvalidationFact>({ kind: "invalidated", at: atValue, owner: ownerValue, cause: causeValue })))))
          : then(fields(state, input, "invalidated", ["at","owner","cause","affected"]), values =>
    then(nodeRef(state, values[0]), atValue =>
    then(originsIdentity(state, values[1]), ownerValue =>
    then(literal(state, values[2], ["overlapping-write"]), causeValue =>
    then(originsIdentity(state, values[3]), affectedValue =>
      accept<ErrorInvalidationFact>({ kind: "invalidated", at: atValue, owner: ownerValue, cause: causeValue, affected: affectedValue })))))));
      }
    }
  });
const parse = <Value>(text: string, decode: Decode<Value>): TextParseResult<Value> => {
  const state: State = { text };
  const tokens = lex(state);
  const decoded: Decoded<Value> = tokens.kind === "invalid" ? tokens : then(syntax(state, tokens.value), root => decode(state, root));
  if (decoded.kind === "value") return { kind: "parsed", value: decoded.value };
  const failure = decoded.failure;
  let line = 1;
  let column = 1;
  for (let offset = 0; offset < failure.offset; offset += 1) {
    if (text.charCodeAt(offset) === 10) { line += 1; column = 1; } else column += 1;
  }
  let found: string | null = failure.offset >= text.length ? null : text.charAt(failure.offset);
  if (tokens.kind === "value") for (const token of tokens.value) if (token.offset === failure.offset) { found = token.text; break; }
  return { kind: "invalid-text", offset: failure.offset, line, column, expected: failure.expected, found };
};

export const parseFacts: ParseFacts = text => parse(text, bodyFacts);
export const parseSummary: ParseSummary = text => parse(text, summary);
export const parseMetadata: ParseMetadata = text => parse(text, metadata);
export const parseCallGraph: ParseCallGraph = text => parse(text, callGraph);
