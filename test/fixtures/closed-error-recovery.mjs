export const closedErrorRecoveryFiles = {
  "failures.ts": `
import type { uint64 } from "@tsonic/core/types.js";
export class BaseFailure extends Error {}
export class DetailedFailure extends BaseFailure {
  readonly code: uint64 = 18446744073709551615n;
}
export class OtherFailure extends Error {}
export class NotFailure {
  name = "DetailedFailure";
  message = "not an Error";
  stack: string | undefined = undefined;
}
export function closed(value: unknown): unknown { return value; }
export function raise(value: unknown, shouldThrow: boolean): unknown {
  if (shouldThrow) throw value;
  return value;
}
export function isDetailed(value: unknown): boolean { return value instanceof DetailedFailure; }
export function code(value: unknown): uint64 {
  if (value instanceof DetailedFailure) return value.code;
  return 0n;
}
export function update(value: unknown): boolean {
  if (!(value instanceof DetailedFailure)) return false;
  value.message = "after";
  value.stack = "explicit stack";
  return true;
}
export function same(value: unknown, original: Error): boolean { return value === original; }
export function inspect(value: unknown): boolean {
  return value instanceof Error && value.message === "after" && value.stack === "explicit stack";
}
`,
  "index.ts": `
import { BaseFailure, DetailedFailure, NotFailure, OtherFailure, closed, code, inspect, isDetailed, raise, same, update } from "./failures.js";
export function run(): boolean {
  const original = new DetailedFailure("before");
  const alias = original;
  const value = closed(original);
  if (!isDetailed(value) || code(value) !== 18446744073709551615n) return false;
  if (!same(value, original) || !update(value)) return false;
  if (alias.message !== "after" || alias.stack !== "explicit stack" || !inspect(value)) return false;
  const other = new OtherFailure("other");
  other.name = "DetailedFailure";
  if (isDetailed(closed(other)) || isDetailed(closed(new NotFailure())) || isDetailed(closed(undefined))) return false;
  try { raise(value, true); }
  catch (caught) {
    if (!(caught instanceof DetailedFailure) || !(caught instanceof BaseFailure)) return false;
    if (caught !== original || caught.code !== 18446744073709551615n || caught.message !== "after") return false;
    caught.message = "changed in catch";
    caught.stack = undefined;
    return original.message === "changed in catch" && alias.stack === null;
  }
  return false;
}
export function main(): void { if (!run()) throw new Error("closed Error capability was lost"); }
`,
};
