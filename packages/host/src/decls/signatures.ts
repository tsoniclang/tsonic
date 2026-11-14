import type { Cause, Diagnostic, ErrorValue, InvariantFailure, Result, UnitAnswerPosition, UnitRequest, UnitValue } from "../diag/contract.js";
import { requirePresent, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { DefId, Origin, TyId } from "../ids/contract.js";
import { decodeDefId, encodeKey } from "../ids/index.js";
import type { HirCallableEndpoint, HirNode } from "../ir-hir/contract.js";
import { inferredPartKey, inferredPartsOf } from "../ir-infer/index.js";
import type { InferredPartRequest, InferredPartType } from "../ir-infer/contract.js";
import type { ArtifactBindings, Signature, SignatureRequest } from "../ir-types/contract.js";
import { encodeSelectorPath, internSignature, internType, readSignature, readType, signatureRequestData, signatureRequestKey, substituteSignature } from "../ir-types/index.js";
import type { DeclaredSignatureErrorData, DeclaredSignaturePause, DeclsInputs, DeclsModule, DeclsStep } from "./contract.js";

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

export function moduleOf(inputs: DeclsInputs, definition: DefId, unit: UnitRequest): DeclsModule {
  const failure = (message: string): never => throwInvariant({ owner: "decls",
    query: { name: unit.query, encodedKey: encodeKey(unit.key) }, origin: null, message });
  const path = decodeDefId(definition);
  if (path.kind !== "decoded") return failure("the definition identity does not decode");
  const checked = findAscending(inputs.modules, path.value.module, candidate => candidate.module.module);
  if (checked === undefined) return failure("the definition's module is not a checked module of the program");
  if (checked.nodes[0] !== checked.module.tree) return failure("the node table given with the module is not the module's own");
  return checked;
}

export function endpointOf(inputs: DeclsInputs, request: SignatureRequest): Endpoint {
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

export function signatureValue(inputs: DeclsInputs, unit: UnitRequest, signature: Signature,
  errors: ReadonlyMap<number | "receiver" | "result", ErrorValue>): UnitValue<Signature> {
  const positions: UnitAnswerPosition[] = [];
  const causes: Cause[] = [];
  const slot = (type: TyId, selector: "receiver" | "result" | number): void => {
    const error = errors.get(selector) ?? null;
    if ((readType(inputs.types, type).kind === "error") !== (error !== null))
      return throwInvariant({ owner: "decls", query: { name: unit.query, encodedKey: encodeKey(unit.key) }, origin: null,
        message: "A signature type position requires its actual error provenance, not an inferred absence." });
    const position = { kind: "component" as const, path: encodeSelectorPath([typeof selector === "number"
      ? { kind: "parameter", signature: signature.id, index: selector } : { kind: selector, signature: signature.id }]) };
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

type SignaturePartValue = Pick<InferredPartType, "part" | "type" | "error">;

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

export function errorSignature(inputs: DeclsInputs, request: SignatureRequest, cause: Cause, data: DeclaredSignatureErrorData): UnitValue<Signature> {
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
  const answers: (SignaturePartValue | undefined)[] = new Array(data.state.parts.length);
  const assign = (index: number, answer: SignaturePartValue): void => {
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
      type: error, error: { kind: "error", causes: [cause] } });
  }
  if (data.unavailable.length === 0 || data.ready.length + data.unavailable.length !== answers.length)
    return throwInvariant(defect(request, selected.origin, "Every signature part requires actual ready evidence or its classified unavailability."));
  return assembleSignature(inputs, data.state, answers.map(answer => requirePresent(answer, defect(request, selected.origin, "A classified signature part has no answer."))), selected,
    unit);
}

export function bindSignature(inputs: DeclsInputs, bindings: ArtifactBindings, signature: Signature, origin: Origin, unit: UnitRequest): Result<Signature> {
  if (bindings.kind === "parametric") return { kind: "ok", value: signature, diagnostics: [] };
  const transformed = substituteSignature(inputs.types, [signature.id], bindings.bindings, inputs.typeExpansion);
  if (transformed.kind === "resource-limit") {
    const diagnostic: Diagnostic = resourceLimitDiagnostic({ owner: "decls", limit: `type expansion ${transformed.dimension}`,
      maximum: transformed.maximum, site: { kind: "source", origin },
      unit: { request: unit, position: { kind: "result" } } });
    return { kind: "refused", diagnostics: [diagnostic] };
  }
  const substituted = requirePresent(transformed.value[0], { owner: "decls", query: { name: unit.query, encodedKey: encodeKey(unit.key) }, origin,
    message: "substitution returned no signature for one signature" });
  return { kind: "ok", value: readSignature(inputs.types, substituted), diagnostics: [] };
}

export function declaredSignatureOf(inputs: DeclsInputs, request: SignatureRequest): SignatureStep {
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

export function assembleSignature(inputs: DeclsInputs, paused: DeclaredSignaturePause, answers: readonly SignaturePartValue[], selected: Endpoint, unit: UnitRequest): UnitValue<Signature> {
  const { request, signature, parts } = paused;
  const { origin, node } = selected;
  const hasChannels = callableChannels(node);
  if (answers.length !== parts.length)
    return throwInvariant(defect(request, origin, `${answers.length} answers for ${parts.length} requests`));
  let result = signature.result;
  const parameterTypes = new Map<number, TyId>();
  const errors = new Map<number | "receiver" | "result", ErrorValue>();
  for (const [position, asked] of parts.entries()) {
    const answer = requirePresent(answers[position], defect(request, origin, `no answer for request ${position}`));
    if (inferredPartKey(answer.part) !== inferredPartKey(asked.part))
      return throwInvariant(defect(request, origin, "An inferred-part answer must retain its actual complete requested part identity."));
    const part = asked.part.part;
    switch (part.kind) {
      case "parameter-initializer":
        parameterTypes.set(part.index, answer.type);
        if (answer.error !== null) errors.set(part.index, answer.error);
        break;
      case "return":
        if (!hasChannels) { result = answer.type; if (answer.error !== null) errors.set("result", answer.error); }
        break;
      case "yield":
        if (!hasChannels) return throwInvariant(defect(request, origin, "a yielded part belongs to no callable body channel"));
        break;
      default: return throwInvariant(defect(request, origin, "a non-signature inferred part was requested for a signature"));
    }
  }
  const parameters = signature.parameters.map((parameter, index) => {
    const type = parameterTypes.get(index);
    return type === undefined ? parameter : { ...parameter, type };
  });
  const placed = internSignature(inputs.types, { declaration: signature.declaration, owner: signature.owner, composition: signature.composition,
    kind: signature.kind, typeParameters: signature.typeParameters, receiver: signature.receiver, parameters, result });
  return signatureValue(inputs, unit, readSignature(inputs.types, placed), errors);
}

export function resumeDeclaredSignatureOf(inputs: DeclsInputs, paused: DeclaredSignaturePause, answers: readonly InferredPartType[]): SignatureStep {
  const unit = { query: "declaredSignatureOf", key: signatureRequestData(paused.request) };
  return { kind: "done", value: { kind: "ok", ...assembleSignature(inputs, paused, answers.map(answer => resolvePart(answer, unit)),
    endpointOf(inputs, paused.request), unit), diagnostics: [], emissions: [] } };
}
