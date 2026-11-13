import { encodeKey } from "../ids/index.js";
import type { CallableEndpointKey, HasOverloadEndpoints, HirCallableEndpoint, SelectedEndpointRoleFaults } from "./contract.js";

export const callableEndpointKey: CallableEndpointKey = endpoint =>
  encodeKey([endpoint.declaration, endpoint.role, endpoint.signature, endpoint.body]);

export const hasOverloadEndpoints: HasOverloadEndpoints = endpoints => {
  for (let position = 0; position < endpoints.length; position += 1) {
    if (endpoints[position]?.role === "advertised") return true;
  }
  return false;
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
