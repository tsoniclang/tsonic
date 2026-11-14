import type { KeyData } from "../ids/contract.js";
import type { HirCallableEndpoint } from "../ir-hir/contract.js";
import { callableEndpointKey } from "../ir-hir/index.js";
import type { AccessLocation, ParameterMapping } from "../ir-infer/contract.js";
import { artifactBindingsData, bindingVectorData, memberStorageData } from "../ir-types/index.js";
import type { MemberSelectionKey, ResolvedCallee } from "./contract.js";

const each = <Value>(values: readonly Value[], project: (value: Value) => KeyData): KeyData =>
  Array.from(values, value => value === undefined ? null : project(value));

const endpointKey = (endpoint: HirCallableEndpoint | null): KeyData => endpoint === null ? null : callableEndpointKey(endpoint);

const locationKey = (location: AccessLocation): KeyData => location.kind === "accessor" ? [location.kind]
  : [location.kind, location.check.kind === "none" ? [location.check.kind] : [location.check.kind, location.check.failure], location.receiver];

const parameterKey = (parameter: ParameterMapping): KeyData => {
  switch (parameter.kind) {
    case "argument": return [parameter.kind, parameter.parameter, parameter.argument, parameter.component, parameter.passing];
    case "default": return [parameter.kind, parameter.parameter, parameter.initializer];
    case "omitted": return [parameter.kind, parameter.parameter, parameter.type];
    case "rest": return [parameter.kind, parameter.parameter, each(parameter.arguments, argument => argument), parameter.passing];
  }
};

const calleeKey = (callee: ResolvedCallee | null): KeyData => {
  if (callee === null) return null;
  const decision = callee.decision;
  const activation = callee.activation;
  return [
    decision.candidate, endpointKey(decision.advertised), endpointKey(decision.api),
    bindingVectorData(decision.bindings), bindingVectorData(decision.implementationBindings),
    each(decision.parameters, parameterKey),
    [decision.completion.signature, decision.completion.completion, decision.completion.yielded, decision.completion.sent],
    decision.result, decision.activation,
    activation === null ? null : [activation.body, artifactBindingsData(activation.bindings)],
  ];
};

export const selectionKey: MemberSelectionKey = member => {
  const decision = member.decision;
  return [
    memberStorageData(decision), decision.read, decision.write,
    endpointKey(decision.getter), endpointKey(decision.setter),
    locationKey(decision.location), calleeKey(member.getter), calleeKey(member.setter),
  ];
};
