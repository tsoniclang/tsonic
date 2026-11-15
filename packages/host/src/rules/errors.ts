import type { Cause, ErrorValue } from "../diag/contract.js";
import { diagnosticIdentityKey, unitPositionData } from "../diag/index.js";
import { encodeKey } from "../ids/index.js";
import type { InferenceValue } from "../ir-infer/contract.js";
import { readType } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { callerDefect } from "./frontier.js";

export function mergeErrors(values: readonly InferenceValue[]): ErrorValue | null {
  const errors: ErrorValue[] = [];
  const seen = new Set<ErrorValue>();
  for (const value of values) if (value.error !== null && !seen.has(value.error)) {
    seen.add(value.error);
    errors.push(value.error);
  }
  if (errors.length === 0) return null;
  if (errors.length === 1) {
    const error = errors[0];
    if (error === undefined) return callerDefect("the actual single error is missing", null);
    return error;
  }
  const causes: Cause[] = [];
  const identities = new Set<string>();
  for (const error of errors) for (const cause of error.causes) {
    const identity = cause.kind === "diagnostic" ? encodeKey(["diagnostic", diagnosticIdentityKey(cause.diagnostic)])
      : encodeKey(["unit", cause.unit.request.query, cause.unit.request.key, unitPositionData(cause.unit.position)]);
    if (!identities.has(identity)) {
      identities.add(identity);
      causes.push(cause);
    }
  }
  const [first, ...rest] = causes;
  if (first === undefined) return callerDefect("an inference error needs at least one actual original cause", null);
  return { kind: "error", causes: [first, ...rest] };
}

export function validateValue(deps: RulesDeps, value: InferenceValue): void {
  if ((readType(deps.types, value.value.type).kind === "error") !== (value.error !== null))
    callerDefect("an inference error type and its actual provenance must be present together", null);
  if (value.error !== null && value.error.causes.length === 0)
    callerDefect("an inference error has no original cause", null);
}
