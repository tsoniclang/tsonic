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

export function validateGraphLimits(port: string, limits: DataflowLimits): void {
  for (const [name, maximum] of [["maximumWork", limits.maximumWork], ["maximumResultEntries", limits.maximumResultEntries]] as const)
    if (!Number.isSafeInteger(maximum) || maximum < 0)
      callerDefect(port, `${name} must be a nonnegative safe integer`);
}

export function validateInferenceLimits(port: string, limits: InferenceLimits, graph: DataflowLimits): void {
  for (const [name, maximum] of [["maximumVariablesPerGroup", limits.maximumVariablesPerGroup],
    ["maximumAtomicContributionsPerGroup", limits.maximumAtomicContributionsPerGroup]] as const)
    if (!Number.isSafeInteger(maximum) || maximum < 0)
      callerDefect(port, `${name} must be a nonnegative safe integer`);
  validateGraphLimits(port, graph);
}
