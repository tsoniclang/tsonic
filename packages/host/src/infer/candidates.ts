import type { HirCallableEndpoint, HirCandidate } from "../ir-hir/contract.js";
import type { DefId } from "../ids/contract.js";
import type { SignatureRequest } from "../ir-types/contract.js";
import type { InferDeps } from "./contract.js";
import { callerDefect, notInferredYet } from "./frontier.js";

export function callableEndpoints(deps: InferDeps, definition: DefId): readonly HirCallableEndpoint[] {
  const item = deps.itemOf(definition);
  if (item.kind !== "FunctionDeclaration")
    return notInferredYet("ConstraintsOf", `the authoritative callable endpoints of ${item.kind}`, item.origin);
  if (item.tsonic.definition !== definition)
    return callerDefect("ConstraintsOf", "a callable endpoint inventory must retain its actual declaration");
  return item.tsonic.signatures;
}

export function endpointRequest(deps: InferDeps, endpoint: HirCallableEndpoint, bindings: SignatureRequest["bindings"]): SignatureRequest {
  let ordinal = 0;
  for (const actual of callableEndpoints(deps, endpoint.declaration)) {
    if (actual === endpoint) return { definition: endpoint.declaration, endpoint: endpoint.role, ordinal, bindings };
    if (actual.role === endpoint.role) ordinal += 1;
  }
  return callerDefect("ConstraintsOf", "a signature request requires its actual checked callable endpoint");
}

export function candidateEndpoint(deps: InferDeps, candidate: HirCandidate): HirCallableEndpoint {
  const endpoints = callableEndpoints(deps, candidate.declaration);
  const endpoint = endpoints[0];
  if (endpoints.length !== 1 || endpoint === undefined || endpoint.role === "advertised")
    return notInferredYet("ConstraintsOf", "the authoritative overloaded candidate correspondence", null);
  if (candidate.appliedSignature.kind !== "available" || candidate.appliedSignature.value !== endpoint.signature
    || candidate.bindings.kind !== "available")
    return notInferredYet("ConstraintsOf", "the original candidate signature and complete binding association", null);
  return endpoint;
}

export function unavailableCandidate(candidate: HirCandidate) {
  if (candidate.appliedSignature.kind === "unavailable") return candidate.appliedSignature;
  if (candidate.bindings.kind === "unavailable") return candidate.bindings;
  if (candidate.conditionalFailure.kind === "unavailable") return candidate.conditionalFailure;
  return null;
}
