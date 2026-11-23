import type { HirCallableEndpoint, HirCandidate, HirNode } from "../ir-hir/contract.js";
import type { DefId } from "../ids/contract.js";
import type { SignatureRequest } from "../ir-types/contract.js";
import { readSignature } from "../ir-types/index.js";
import type { GroupDeps, InferenceInputs } from "./contract.js";
import { callerDefect, notInferredYet } from "./frontier.js";

export function callableEndpoints(deps: GroupDeps, definition: DefId): readonly HirCallableEndpoint[] {
  return endpointsOf(deps.itemOf(definition), definition);
}

export function endpointsOf(item: HirNode, definition: DefId): readonly HirCallableEndpoint[] {
  const callable = item.tsonic;
  if (callable === null || !("signatures" in callable))
    return notInferredYet("ConstraintsOf", `the authoritative callable endpoints of ${item.kind}`, item.origin);
  if (callable.definition !== definition)
    return callerDefect("ConstraintsOf", "a callable endpoint inventory must retain its actual declaration");
  return callable.signatures;
}

export function endpointRequest(deps: GroupDeps, endpoint: HirCallableEndpoint, bindings: SignatureRequest["bindings"]): SignatureRequest {
  let ordinal = 0;
  for (const actual of callableEndpoints(deps, endpoint.declaration)) {
    if (actual === endpoint) return { definition: endpoint.declaration, endpoint: endpoint.role, ordinal, bindings };
    if (actual.role === endpoint.role) ordinal += 1;
  }
  return callerDefect("ConstraintsOf", "a signature request requires its actual checked callable endpoint");
}

export function candidateEndpoint(deps: InferenceInputs, candidate: HirCandidate): HirCallableEndpoint {
  const endpoints = callableEndpoints(deps, candidate.declaration);
  const endpoint = endpoints[0];
  if (endpoints.length !== 1 || endpoint === undefined || endpoint.role === "advertised")
    return notInferredYet("ConstraintsOf", "the authoritative overloaded candidate correspondence", null);
  if (candidate.appliedSignature.kind !== "available" || candidate.bindings.kind !== "available")
    return notInferredYet("ConstraintsOf", "the original candidate signature and complete binding association", null);
  if (candidate.appliedSignature.value !== endpoint.signature) {
    const original = readSignature(deps.types, endpoint.signature);
    const applied = readSignature(deps.types, candidate.appliedSignature.value);
    if (original.typeParameters.length === 0)
      return notInferredYet("ConstraintsOf", "the authoritative applied signature of a non-generic candidate", null);
    const bindings = candidate.bindings.value;
    if (original.declaration !== endpoint.declaration || applied.declaration !== endpoint.declaration
      || applied.typeParameters.length !== 0 || original.kind !== applied.kind
      || bindings.methodBindings.length !== original.typeParameters.length
      || bindings.classBindings.length !== 0 || bindings.capturedBindings.length !== 0 || bindings.selfBindings.length !== 0
      || original.typeParameters.some((parameter, index) => {
        const binding = bindings.methodBindings[index];
        return binding?.kind !== "bound" || binding.parameter !== parameter.declaration;
      })) return callerDefect("ConstraintsOf", "an applied signature requires the actual callable's original parameter bindings");
  }
  return endpoint;
}

export function unavailableCandidate(candidate: HirCandidate) {
  if (candidate.appliedSignature.kind === "unavailable") return candidate.appliedSignature;
  if (candidate.bindings.kind === "unavailable") return candidate.bindings;
  if (candidate.conditionalFailure.kind === "unavailable") return candidate.conditionalFailure;
  return null;
}
