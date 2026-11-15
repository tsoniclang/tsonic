import type { Origin } from "../ids/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { DataflowLimits } from "../dataflow/contract.js";
import type { InferenceLimits } from "./contract.js";

export function notInferredYet(port: string, what: string, origin: Origin | null): never {
  return throwInvariant({ owner: "infer", query: null, origin, message: `${port}: ${what} is not inferred yet` });
}

export function callerDefect(port: string, message: string): never {
  return throwInvariant({ owner: "infer", query: null, origin: null, message: `${port}: caller defect: ${message}` });
}

function validateMaximum(port: string, name: string, maximum: number): void {
  if (!Number.isSafeInteger(maximum) || maximum < 0 || Object.is(maximum, -0))
    callerDefect(port, `${name} must be a nonnegative safe integer`);
}

export function validateGraphLimits(port: string, limits: DataflowLimits): void {
  validateMaximum(port, "maximumWork", limits.maximumWork);
  validateMaximum(port, "maximumResultEntries", limits.maximumResultEntries);
}

export function validateInferenceLimits(port: string, limits: InferenceLimits, graph: DataflowLimits): void {
  validateMaximum(port, "maximumVariablesPerGroup", limits.maximumVariablesPerGroup);
  validateMaximum(port, "maximumAtomicContributionsPerGroup", limits.maximumAtomicContributionsPerGroup);
  validateGraphLimits(port, graph);
}
