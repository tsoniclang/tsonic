import type { DiagnosticIdentityKey, HostDiagnosticCode, HostDiagnosticCodeConstructor, LookupDiagnostic, OrderDiagnostics, RequirePresent, ResourceLimitDiagnostic, ThrowInvariant } from "./contract.js";
import { failInvariant } from "./invariant.js";
import { findDiagnosticDefinition, identityKey, limitDiagnostic, sortDiagnostics } from "./order.js";

export const throwInvariant: ThrowInvariant = failInvariant;
export const requirePresent: RequirePresent = (value, failure) => value === undefined ? throwInvariant(failure) : value;
export const orderDiagnostics: OrderDiagnostics = sortDiagnostics;
export const lookupDiagnostic: LookupDiagnostic = findDiagnosticDefinition;
export const diagnosticIdentityKey: DiagnosticIdentityKey = identityKey;
export const hostDiagnosticCode: HostDiagnosticCodeConstructor = name => name as HostDiagnosticCode;
export const resourceLimitDiagnostic: ResourceLimitDiagnostic = report =>
  limitDiagnostic(hostDiagnosticCode("TSONIC_COMPILER_RESOURCE_LIMIT"), report);
