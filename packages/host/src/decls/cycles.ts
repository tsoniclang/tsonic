import type { Cause, Diagnostic, DiagnosticIdentity } from "../diag/contract.js";
import { hostDiagnosticCode, throwInvariant } from "../diag/index.js";
import { inferredPartKey } from "../ir-infer/index.js";
import { admitTypePublicationStep, refuseTypeConstruction, signatureRequestKey } from "../ir-types/index.js";
import type { ClassifyCycle, DeclarationCycleMember, DeclaredSignatureErrorData } from "./contract.js";
import { endpointOf, prepareSignatureError, signatureComponentPosition } from "./signatures.js";

function fail(message: string): never {
  return throwInvariant({ owner: "decls", query: null, origin: null, message });
}

export const classifyCycle: ClassifyCycle = (inputs, members) => {
  const payloads = new Map<DeclarationCycleMember, DeclaredSignatureErrorData>();
  let detector: DeclarationCycleMember | undefined;
  let detectorKey: string | undefined;
  for (let index = 0; index < members.length; index += 1) {
    const member = members[index];
    const next = members[(index + 1) % members.length];
    if (member === undefined || next === undefined) return fail("A closed semantic cycle has no missing members.");
    const producer = member.producer;
    if (producer.kind === "inference-solution") {
      if (member.target.kind !== "inference-solution" || member.target.group !== producer.group
        || member.unit.key !== producer.group.id || member.answerPolicy !== "refusal-only")
        return fail("An inference cycle member retains its actual incoming group and registered answer capability.");
      continue;
    }
    if (member.target.kind !== "declared-signature" || member.answerPolicy !== "typed-error"
      || signatureRequestKey(member.target.request) !== signatureRequestKey(producer.state.request))
      return fail("A signature cycle member retains its actual incoming endpoint and paused producer.");
    const indexOfPart = producer.ready.length;
    const pending = producer.state.parts[indexOfPart];
    if (pending === undefined || next.target.kind !== "inference-solution"
      || !next.target.group.signatures.some(part => inferredPartKey(part) === inferredPartKey(pending.part)))
      return fail("The unavailable signature part must be the actual pending demand owned by the next canonical inference group.");
    for (let readyIndex = 0; readyIndex < producer.ready.length; readyIndex += 1) {
      const answer = producer.ready[readyIndex];
      const request = producer.state.parts[readyIndex];
      if (answer === undefined || request === undefined || inferredPartKey(answer.part) !== inferredPartKey(request.part))
        return fail("A classified signature retains its exact ordered ready part answers.");
    }
    if (indexOfPart + 1 !== producer.state.parts.length)
      return fail("The cycle witness has not supplied the readiness of later signature parts; their unavailability cannot be guessed.");
    const stop = admitTypePublicationStep(inputs.typeWork, producer.ready.length);
    if (stop !== null) {
      const refusal = refuseTypeConstruction(inputs.typeWork, stop, endpointOf(inputs, producer.state.request).origin, member.unit);
      return members.map(() => ({ kind: "refused", diagnostic: refusal.diagnostics[0] }));
    }
    const payload = prepareSignatureError(inputs, producer.state.request, { kind: "declared-signature", state: producer.state,
      ready: producer.ready.map((answer, index) => ({ index, answer })), unavailable: [indexOfPart] });
    if (payload.kind === "refused") return members.map(() => ({ kind: "refused", diagnostic: payload.diagnostics[0] }));
    payloads.set(member, payload.value);
    const key = signatureRequestKey(producer.state.request);
    if (detectorKey === undefined || key < detectorKey) { detector = member; detectorKey = key; }
  }
  if (detector === undefined || detector.producer.kind !== "declared-signature")
    return fail("A closed inference-only dependency cycle contradicts the completed canonical group partition.");
  const state = detector.producer.state;
  const part = state.parts[detector.producer.ready.length]?.part.part;
  if (part === undefined) return fail("The detecting declaration has no actual unavailable type position.");
  const prepared = payloads.get(detector);
  if (prepared === undefined) return fail("The detecting declaration must have its final error signature.");
  const endpoint = endpointOf(inputs, state.request);
  const selector = part.kind === "parameter-initializer" ? part.index : part.kind === "return" ? "result"
    : fail("A public signature cycle requires its actual type slot, not an executing body channel.");
  const position = signatureComponentPosition(prepared.signature.id, selector);
  const code = hostDiagnosticCode("TSONIC_TYPE_DEPENDENCY_CYCLE");
  const identity: DiagnosticIdentity = { kind: "host", code, unit: { request: detector.unit, position } };
  const originated: Cause = { kind: "diagnostic", diagnostic: identity };
  const absorbed: Cause = { kind: "unit", unit: identity.unit };
  const diagnostic: Diagnostic = {
    code: { kind: "host", name: code, rendered: code }, severity: "error", site: { kind: "source", origin: endpoint.origin },
    source: "decls", evidence: [], message: "The inferred signature part depends on its own completed signature.",
    arguments: [], related: [], fix: null,
  };
  return members.map(member => {
    if (member.answerPolicy === "refusal-only") return { kind: "refused", diagnostic };
    const data = payloads.get(member);
    if (data === undefined) return fail("Every typed-error cycle member requires its actual classified constructor data.");
    return { kind: "error", cause: member === detector ? originated : absorbed, data, diagnostics: member === detector ? [diagnostic] : [],
      emissions: member === detector ? [{ identity, diagnostic }] : [] };
  });
};
