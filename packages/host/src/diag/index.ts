import type { HostDiagnosticCode, HostDiagnosticCodeConstructor, LookupDiagnostic, OrderDiagnostics, RequirePresent, ThrowInvariant } from "./contract.js";
import { failInvariant } from "./invariant.js";
import { findDiagnosticDefinition, sortDiagnostics } from "./order.js";

export const throwInvariant: ThrowInvariant = failInvariant;
export const requirePresent: RequirePresent = (value, failure) => value === undefined ? throwInvariant(failure) : value;
export const orderDiagnostics: OrderDiagnostics = sortDiagnostics;
export const lookupDiagnostic: LookupDiagnostic = findDiagnosticDefinition;
export const hostDiagnosticCode: HostDiagnosticCodeConstructor = name => name as HostDiagnosticCode;
