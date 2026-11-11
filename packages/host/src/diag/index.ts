import type { HostDiagnosticCode, HostDiagnosticCodeConstructor, LookupDiagnostic, OrderDiagnostics, ThrowInvariant } from "./contract.js";
import { failInvariant } from "./invariant.js";
import { findDiagnosticDefinition, sortDiagnostics } from "./order.js";

export const throwInvariant: ThrowInvariant = failInvariant;
export const orderDiagnostics: OrderDiagnostics = sortDiagnostics;
export const lookupDiagnostic: LookupDiagnostic = findDiagnosticDefinition;
export const hostDiagnosticCode: HostDiagnosticCodeConstructor = name => name as HostDiagnosticCode;
