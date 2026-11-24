import type { Cause, Diagnostic, ErrorValue, InvariantFailure, Result, UnitAnswerPosition, UnitPosition, UnitRequest, UnitValue } from "../diag/contract.js";
import { requirePresent, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { DefId, Origin, SigId, TyId } from "../ids/contract.js";
import { decodeDefId, encodeKey } from "../ids/index.js";
import type { CheckedTypingCuts, HirCallableEndpoint, HirNode } from "../ir-hir/contract.js";
import { inferredPartKey, inferredPartsOf } from "../ir-infer/index.js";
import type { InferredPartRequest, InferredPartType } from "../ir-infer/contract.js";
import type { ArtifactBindings, Signature, SignatureInput, SignatureRequest, TypePublicationStop, TypeTransform } from "../ir-types/contract.js";
import { admitTypePublicationStep, encodeSelectorPath, internType, internTypeGraph, readSignature, readType, refuseTypeConstruction,
  signatureRequestData, signatureRequestKey, substituteSignature, viewTypes } from "../ir-types/index.js";
import type { DeclaredSignatureErrorData, DeclaredSignaturePause, DeclsDeps, DeclsModule, DeclsStep } from "./contract.js";

type SignatureStep = DeclsStep<Signature, DeclaredSignaturePause>;

const defect = (request: SignatureRequest, origin: Origin | null, message: string): InvariantFailure =>
  ({ owner: "decls", query: { name: "declaredSignatureOf", encodedKey: signatureRequestKey(request) }, origin, message });

const HOLE: InvariantFailure = { owner: "decls", query: null, origin: null, message: "a list holds no element at a position below its length" };

export function findAscending<Item>(list: readonly Item[], key: string, keyOf: (item: Item) => string): Item | undefined {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const item = requirePresent(list[middle], HOLE);
    const current = keyOf(item);
    if (current === key) return item;
    if (current < key) low = middle + 1;
    else high = middle;
  }
  return undefined;
}

interface Endpoint {
  readonly endpoint: HirCallableEndpoint;
  readonly node: HirNode;
  readonly origin: Origin;
}

export function moduleOf(inputs: DeclsDeps, definition: DefId, unit: UnitRequest): DeclsModule {
  const failure = (message: string): never => throwInvariant({ owner: "decls",
    query: { name: unit.query, encodedKey: encodeKey(unit.key) }, origin: null, message });
  const path = decodeDefId(definition);
  if (path.kind !== "decoded") return failure("the definition identity does not decode");
  const checked = findAscending(inputs.modules, path.value.module, candidate => candidate.module.module);
  if (checked === undefined) return failure("the definition's module is not a checked module of the program");
  if (checked.nodes[0] !== checked.module.tree) return failure("the node table given with the module is not the module's own");
  return checked;
}

export function endpointOf(inputs: DeclsDeps, request: SignatureRequest): Endpoint {
  const checked = moduleOf(inputs, request.definition, { query: "declaredSignatureOf", key: signatureRequestData(request) });
  const item = findAscending(checked.module.items, request.definition, entry => entry.definition);
  if (item === undefined) return throwInvariant(defect(request, null, "the definition is not a declaration entry of its module"));
  const node = checked.nodes[item.node];
  if (node === undefined || !Object.is(node.id, item.node))
    return throwInvariant(defect(request, null, "the definition's declaration entry names a node the module does not have"));
  const payload = node.tsonic;
  if (payload === null || !("signatures" in payload)) return throwInvariant(defect(request, node.origin, `a ${node.kind} has no endpoints`));
  const selected = payload.signatures.filter(endpoint => endpoint.role === request.endpoint)[request.ordinal];
  if (selected === undefined)
    return throwInvariant(defect(request, node.origin, `the definition has no ${request.endpoint} endpoint at ordinal ${request.ordinal}`));
  return { endpoint: selected, node, origin: node.origin };
}

export function inferredParts(request: SignatureRequest, endpoint: Endpoint, signature: Signature): readonly InferredPartRequest[] {
  if (endpoint.endpoint.body === null) return [];
  return inferredPartsOf(request.definition, endpoint.node).map(part => {
    if (part.part.kind === "parameter-initializer" && signature.parameters[part.part.index] === undefined)
      return throwInvariant(defect(request, endpoint.origin, `the declaration's parameter ${part.part.index} has no row in its signature`));
    return { kind: "inferred-part", part };
  });
}

export function signatureValue(inputs: DeclsDeps, unit: UnitRequest, signature: Signature,
  errors: ReadonlyMap<number | "receiver" | "result", ErrorValue>): UnitValue<Signature> {
  const positions: UnitAnswerPosition[] = [];
  const causes: Cause[] = [];
  const slot = (type: TyId, selector: "receiver" | "result" | number): void => {
    const error = errors.get(selector) ?? null;
    if ((readType(inputs.types, type).kind === "error") !== (error !== null))
      return throwInvariant({ owner: "decls", query: { name: unit.query, encodedKey: encodeKey(unit.key) }, origin: null,
        message: "A signature type position requires its actual error provenance, not an inferred absence." });
    const position = signatureComponentPosition(signature.id, selector);
    positions.push({ position, error });
    if (error !== null) causes.push({ kind: "unit", unit: {
      request: unit, position } });
  };
  if (signature.receiver !== null) slot(signature.receiver, "receiver");
  signature.parameters.forEach((parameter, index) => { slot(parameter.type, index); });
  slot(signature.result, "result");
  const first = causes[0];
  positions.push({ position: { kind: "result" }, error: first === undefined ? null : { kind: "error", causes: [first, ...causes.slice(1)] } });
  return { value: signature, positions };
}

export function signatureComponentPosition(signature: SigId, selector: number | "receiver" | "result"): UnitPosition {
  return { kind: "component", path: encodeSelectorPath([typeof selector === "number"
    ? { kind: "parameter", signature, index: selector } : { kind: selector, signature }]) };
}

type SignaturePartValue = Pick<InferredPartType, "part" | "type" | "error">;
type SignaturePartType = Pick<SignaturePartValue, "part" | "type">;
type SignatureErrorInputs = Pick<DeclaredSignatureErrorData, "kind" | "state" | "ready" | "unavailable">;

export function resolvePart(answer: InferredPartType, unit: UnitRequest): SignaturePartValue {
  const origin = answer.origin;
  if (origin === undefined || origin.position.kind !== "inference-variable"
    || origin.request.key !== origin.position.group || !Number.isSafeInteger(origin.position.variable)
    || origin.position.variable < 0 || Object.is(origin.position.variable, -0))
    return throwInvariant({ owner: "decls", query: { name: unit.query, encodedKey: encodeKey(unit.key) }, origin: null,
      message: "A real inferred part requires its actual finalized variable origin." });
  return { part: answer.part, type: answer.type, error: answer.error === null
    ? null : { kind: "error", causes: [{ kind: "unit", unit: origin }] } };
}

export function prepareSignatureError(inputs: DeclsDeps, request: SignatureRequest, data: SignatureErrorInputs): Result<DeclaredSignatureErrorData> {
  const selected = endpointOf(inputs, request);
  if (data.kind !== "declared-signature" || signatureRequestKey(data.state.request) !== signatureRequestKey(request))
    return throwInvariant(defect(request, selected.origin, "The classified error data belongs to another semantic request."));
  const expected = inferredParts(request, selected, data.state.signature);
  if (expected.length !== data.state.parts.length || expected.some((part, index) => {
    const held = data.state.parts[index];
    return held === undefined || held.part.definition !== part.part.definition || held.part.part.kind !== part.part.part.kind
      || (part.part.part.kind === "parameter-initializer" && (held.part.part.kind !== "parameter-initializer" || held.part.part.index !== part.part.part.index));
  })) return throwInvariant(defect(request, selected.origin, "The classified error data must retain the producer's actual paused part relation."));
  const unit = { query: "declaredSignatureOf", key: signatureRequestData(request) };
  const stop = admitTypePublicationStep(inputs.typeWork, data.state.parts.length + data.ready.length + data.unavailable.length);
  if (stop !== null) return refuseTypeConstruction(inputs.typeWork, stop, selected.origin, unit);
  const answers: (SignaturePartType | undefined)[] = new Array(data.state.parts.length);
  const assign = (index: number, answer: SignaturePartType): void => {
    if (!Number.isInteger(index) || index < 0 || index >= answers.length || answers[index] !== undefined)
      return throwInvariant(defect(request, selected.origin, "Ready and unavailable signature parts must be distinct actual request positions."));
    answers[index] = answer;
  };
  for (const ready of data.ready) assign(ready.index, resolvePart(ready.answer, unit));
  const error = internType(inputs.types, { kind: "error" });
  for (const index of data.unavailable) {
    const part = data.state.parts[index]?.part.part;
    if (part === undefined || part.kind === "yield" || (part.kind === "return" && callableChannels(selected.node)))
      return throwInvariant(defect(request, selected.origin, "A body-channel failure is not an unavailable public signature type position."));
    assign(index, { part: requirePresent(data.state.parts[index], defect(request, selected.origin, "An unavailable part has no request.")).part,
      type: error });
  }
  if (data.unavailable.length === 0 || data.ready.length + data.unavailable.length !== answers.length)
    return throwInvariant(defect(request, selected.origin, "Every signature part requires actual ready evidence or its classified unavailability."));
  const signature = assembleSignatureType(inputs, data.state, answers.map(answer => requirePresent(answer,
    defect(request, selected.origin, "A classified signature part has no answer."))), selected, unit, () => {});
  return signature.kind === "refused" ? signature : { kind: "ok", value: { ...data, signature: signature.value }, diagnostics: [] };
}

export function errorSignature(inputs: DeclsDeps, request: SignatureRequest, cause: Cause, data: DeclaredSignatureErrorData): UnitValue<Signature> {
  if (data.kind !== "declared-signature" || signatureRequestKey(data.state.request) !== signatureRequestKey(request)
    || readSignature(inputs.types, data.signature.id) !== data.signature)
    return throwInvariant(defect(request, null, "The prepared error signature belongs to another semantic request or type arena."));
  const unit = { query: "declaredSignatureOf", key: signatureRequestData(request) };
  const errors = new Map<number | "result", ErrorValue>();
  const selected = endpointOf(inputs, request);
  const fail = defect(request, selected.origin, "A classified signature error requires its actual signature type position.");
  const retain = (index: number, error: ErrorValue, required: boolean): void => {
    const part = data.state.parts[index]?.part.part;
    if (part?.kind === "parameter-initializer") errors.set(part.index, error);
    else if (part?.kind === "return" && !callableChannels(selected.node)) errors.set("result", error);
    else if (required) throwInvariant(fail);
  };
  for (const ready of data.ready) {
    const error = resolvePart(ready.answer, unit).error;
    if (error !== null) retain(ready.index, error, false);
  }
  const unavailable: ErrorValue = { kind: "error", causes: [cause] };
  for (const index of data.unavailable) retain(index, unavailable, true);
  return signatureValue(inputs, unit, data.signature, errors);
}

export function finishTypeTransform<Value>(inputs: DeclsDeps, transformed: TypeTransform<Value> | TypePublicationStop,
  origin: Origin, unit: UnitRequest): Result<Value> {
  if (transformed.kind === "resource-limit") {
    if (transformed.dimension === "work" || transformed.dimension === "created-records")
      return refuseTypeConstruction(inputs.typeWork, transformed, origin, unit);
    const diagnostic: Diagnostic = resourceLimitDiagnostic({ owner: "decls", limit: `type expansion ${transformed.dimension}`,
      maximum: transformed.maximum, site: { kind: "source", origin },
      unit: { request: unit, position: { kind: "result" } } });
    return { kind: "refused", diagnostics: [diagnostic] };
  }
  return { kind: "ok", value: transformed.value, diagnostics: [] };
}

export function bindSignature(inputs: DeclsDeps, bindings: ArtifactBindings, signature: Signature, origin: Origin, unit: UnitRequest): Result<Signature> {
  if (bindings.kind === "parametric") return { kind: "ok", value: signature, diagnostics: [] };
  const transformed = finishTypeTransform(inputs,
    substituteSignature(inputs.types, [signature.id], bindings.bindings, inputs.typeExpansion, "selected", inputs.typeWork), origin, unit);
  if (transformed.kind === "refused") return transformed;
  const substituted = requirePresent(transformed.value[0], { owner: "decls", query: { name: unit.query, encodedKey: encodeKey(unit.key) }, origin,
    message: "substitution returned no signature for one signature" });
  return { kind: "ok", value: readSignature(inputs.types, substituted), diagnostics: [] };
}

export function declaredSignatureOf(inputs: DeclsDeps, request: SignatureRequest, cuts: CheckedTypingCuts): SignatureStep {
  const cut = cuts.declaration(request.definition);
  if (cut !== null) return { kind: "done", value: { kind: "refused", diagnostics: cut.diagnostics } };
  const selected = endpointOf(inputs, request);
  const { endpoint, origin } = selected;
  const bound = bindSignature(inputs, request.bindings, readSignature(inputs.types, endpoint.signature), origin,
    { query: "declaredSignatureOf", key: signatureRequestData(request) });
  if (bound.kind === "refused") return { kind: "done", value: bound };
  const signature = bound.value;
  const [first, ...rest] = inferredParts(request, selected, signature);
  if (first === undefined) return { kind: "done", value: { kind: "ok", ...signatureValue(inputs,
    { query: "declaredSignatureOf", key: signatureRequestData(request) }, signature, new Map()), diagnostics: [], emissions: [] } };
  const parts: readonly [InferredPartRequest, ...InferredPartRequest[]] = [first, ...rest];
  return { kind: "paused", requests: parts, paused: { request, signature, parts }, earned: [] };
}

function callableChannels(node: HirNode): boolean {
  return (node.kind === "FunctionDeclaration" || node.kind === "FunctionExpression" || node.kind === "ArrowFunction" || node.kind === "MethodDeclaration" || node.kind === "GetAccessor")
    && (node.asteriskToken !== null || node.modifiers?.nodes.some(modifier => modifier.kind === "AsyncKeyword") === true);
}

export function constructSignature(inputs: DeclsDeps, signature: SignatureInput, unit: UnitRequest, origin: Origin): Result<Signature> {
  const table = viewTypes(inputs.types);
  const result = internTypeGraph({ types: inputs.types, work: inputs.typeWork }, {
    typeBase: table.terms.length, signatureBase: table.signatures.length, terms: [], signatures: [signature],
  });
  if (result.kind !== "complete") return refuseTypeConstruction(inputs.typeWork, result, origin, unit);
  return { kind: "ok", diagnostics: [], value: readSignature(inputs.types, requirePresent(result.value.signatures[0], HOLE)) };
}

function assembleSignatureType<Answer extends SignaturePartType>(inputs: DeclsDeps, paused: DeclaredSignaturePause,
  answers: readonly Answer[], selected: Endpoint, unit: UnitRequest, retain: (slot: number | "result", answer: Answer) => void): Result<Signature> {
  const { request, signature, parts } = paused;
  const { origin, node } = selected;
  const hasChannels = callableChannels(node);
  if (answers.length !== parts.length)
    return throwInvariant(defect(request, origin, `${answers.length} answers for ${parts.length} requests`));
  let result = signature.result;
  const parameterTypes = new Map<number, TyId>();
  for (let position = 0; position < parts.length; position++) {
    const stop = admitTypePublicationStep(inputs.typeWork);
    if (stop !== null) return refuseTypeConstruction(inputs.typeWork, stop, origin, unit);
    const asked = requirePresent(parts[position], HOLE);
    const answer = requirePresent(answers[position], defect(request, origin, `no answer for request ${position}`));
    if (inferredPartKey(answer.part) !== inferredPartKey(asked.part))
      return throwInvariant(defect(request, origin, "An inferred-part answer must retain its actual complete requested part identity."));
    const part = asked.part.part;
    switch (part.kind) {
      case "parameter-initializer":
        parameterTypes.set(part.index, answer.type);
        retain(part.index, answer);
        break;
      case "return":
        if (!hasChannels) { result = answer.type; retain("result", answer); }
        break;
      case "yield":
        if (!hasChannels) return throwInvariant(defect(request, origin, "a yielded part belongs to no callable body channel"));
        break;
      default: return throwInvariant(defect(request, origin, "a non-signature inferred part was requested for a signature"));
    }
  }
  const parameterStop = admitTypePublicationStep(inputs.typeWork, signature.parameters.length);
  if (parameterStop !== null) return refuseTypeConstruction(inputs.typeWork, parameterStop, origin, unit);
  const parameters = signature.parameters.map((parameter, index) => {
    const type = parameterTypes.get(index);
    return type === undefined ? parameter : { ...parameter, type };
  });
  return constructSignature(inputs, { declaration: signature.declaration, owner: signature.owner, composition: signature.composition,
    kind: signature.kind, typeParameters: signature.typeParameters, receiver: signature.receiver, parameters, result }, unit, origin);
}

export function assembleSignature(inputs: DeclsDeps, paused: DeclaredSignaturePause, answers: readonly SignaturePartValue[],
  selected: Endpoint, unit: UnitRequest): Result<UnitValue<Signature>> {
  const errors = new Map<number | "result", ErrorValue>();
  const signature = assembleSignatureType(inputs, paused, answers, selected, unit, (slot, answer) => {
    if (answer.error !== null) errors.set(slot, answer.error);
  });
  return signature.kind === "refused" ? signature : { kind: "ok", value: signatureValue(inputs, unit, signature.value, errors), diagnostics: [] };
}

export function resumeDeclaredSignatureOf(inputs: DeclsDeps, paused: DeclaredSignaturePause, answers: readonly InferredPartType[]): SignatureStep {
  const unit = { query: "declaredSignatureOf", key: signatureRequestData(paused.request) };
  const selected = endpointOf(inputs, paused.request);
  const stop = admitTypePublicationStep(inputs.typeWork, answers.length);
  if (stop !== null) return { kind: "done", value: refuseTypeConstruction(inputs.typeWork, stop, selected.origin, unit) };
  const result = assembleSignature(inputs, paused, answers.map(answer => resolvePart(answer, unit)), selected, unit);
  return { kind: "done", value: result.kind === "refused" ? result : { kind: "ok", ...result.value, diagnostics: [], emissions: [] } };
}
