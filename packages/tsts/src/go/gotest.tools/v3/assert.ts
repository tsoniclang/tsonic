import type { bool } from "@tsonic/core/types.js";
import type { TB } from "../../testing.js";
import { DeepEqual as reflectDeepEqual } from "../../reflect.js";
import { Sprint, Sprintf } from "../../fmt.js";

export interface TestingT extends TB {}
export type Comparison = () => string | undefined | bool;

export function Assert(t: TestingT, comparison: unknown, ...msgAndArgs: Array<unknown>): void {
  if (!evaluateComparison(comparison)) {
    t.Fatal(failureMessage("assertion failed", msgAndArgs));
  }
}

export function Check(t: TestingT, comparison: unknown, ...msgAndArgs: Array<unknown>): bool {
  if (evaluateComparison(comparison)) {
    return true as bool;
  }
  t.Error(failureMessage("check failed", msgAndArgs));
  return false as bool;
}

export function DeepEqual(t: TestingT, actual: unknown, expected: unknown, ...msgAndArgs: Array<unknown>): void {
  if (!reflectDeepEqual(actual, expected)) {
    t.Fatal(failureMessage(`not deep equal:\nactual: ${Sprint(actual)}\nexpected: ${Sprint(expected)}`, msgAndArgs));
  }
}

export function Equal(t: TestingT, actual: unknown, expected: unknown, ...msgAndArgs: Array<unknown>): void {
  if (actual !== expected) {
    t.Fatal(failureMessage(`not equal: ${Sprint(actual)} != ${Sprint(expected)}`, msgAndArgs));
  }
}

export function Error(t: TestingT, err: Error | undefined, expected: string, ...msgAndArgs: Array<unknown>): void {
  if (err === undefined || err.message !== expected) {
    t.Fatal(failureMessage(`expected error ${expected}, got ${err?.message ?? "<nil>"}`, msgAndArgs));
  }
}

export function ErrorContains(t: TestingT, err: Error | undefined, expected: string, ...msgAndArgs: Array<unknown>): void {
  if (err === undefined || !err.message.includes(expected)) {
    t.Fatal(failureMessage(`expected error containing ${expected}, got ${err?.message ?? "<nil>"}`, msgAndArgs));
  }
}

export function NilError(t: TestingT, err: Error | undefined, ...msgAndArgs: Array<unknown>): void {
  if (err !== undefined) {
    t.Fatal(failureMessage(`expected nil error, got ${err.message}`, msgAndArgs));
  }
}

function evaluateComparison(comparison: unknown): bool {
  if (typeof comparison === "function") {
    const result = (comparison as Comparison)();
    return (result === undefined || result === true) as bool;
  }
  return Boolean(comparison) as bool;
}

function failureMessage(defaultMessage: string, msgAndArgs: Array<unknown>): string {
  if (msgAndArgs.length === 0) {
    return defaultMessage;
  }
  const [format, ...args] = msgAndArgs;
  if (typeof format === "string" && args.length > 0) {
    return `${defaultMessage}: ${Sprintf(format, ...args)}`;
  }
  return `${defaultMessage}: ${msgAndArgs.map((arg) => Sprint(arg)).join(" ")}`;
}
