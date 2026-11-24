import { encodeKey } from "../ids/index.js";
import type { CallableEndpointKey, CheckedParameterHeadersOf, HasOverloadEndpoints, HirCallableEndpoint, SelectedEndpointRoleFaults } from "./contract.js";

export const callableEndpointKey: CallableEndpointKey = endpoint =>
  encodeKey([endpoint.declaration, endpoint.role, endpoint.signature, endpoint.body]);

export const hasOverloadEndpoints: HasOverloadEndpoints = endpoints => {
  for (let position = 0; position < endpoints.length; position += 1) {
    if (endpoints[position]?.role === "advertised") return true;
  }
  return false;
};

export const checkedParameterHeadersOf: CheckedParameterHeadersOf = (callable, body, definitionAt) => {
  switch (callable.kind) {
    case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunction": case "MethodDeclaration":
    case "Constructor": case "GetAccessor": case "SetAccessor":
      break;
    default: return null;
  }
  const headers = callable.parameters.nodes;
  if (!("body" in callable.tsonic) || definitionAt(callable.id) !== body.owner
    || "definition" in callable.tsonic && callable.tsonic.definition !== body.owner
    || callable.tsonic.body !== body.body || callable !== body.root && callable.body !== body.root
    || headers.length !== body.params.length) return null;
  for (let position = 0; position < headers.length; position += 1) {
    const parameter = body.params[position];
    if (parameter === undefined || !Number.isSafeInteger(parameter.local) || parameter.local < 0 || Object.is(parameter.local, -0)) return null;
    const local = body.locals[parameter.local];
    const declaration = local?.declaration;
    const header = headers[position];
    if (local === undefined || !Object.is(local.id, parameter.local) || local.role !== "parameter"
      || declaration?.kind !== "item" || declaration.value.owner !== parameter.declaration
      || header === undefined || header.id !== declaration.value.node || header.parent !== callable.id
      || header.tsonic.parent !== body.owner || definitionAt(header.id) !== parameter.declaration) return null;
    const selected = header.tsonic.declaration;
    if (selected.kind !== "local" || selected.local.body !== body.body || !Object.is(selected.local.local, parameter.local)) return null;
  }
  return headers;
};

const sameEndpoint = (advertised: HirCallableEndpoint, api: HirCallableEndpoint): boolean =>
  advertised.declaration === api.declaration && advertised.role === api.role &&
  Object.is(advertised.signature, api.signature) && advertised.body === api.body;

export const selectedEndpointRoleFaults: SelectedEndpointRoleFaults = (overloaded, advertised, api) => {
  const advertisedFault = overloaded ? advertised.role !== "advertised" : !sameEndpoint(advertised, api);
  const apiFault = api.role === "advertised" || api.role === "api-body" && api.body === null ||
    api.role === "api-signature" && api.body !== null;
  return advertisedFault ? apiFault ? 3 : 1 : apiFault ? 2 : 0;
};
