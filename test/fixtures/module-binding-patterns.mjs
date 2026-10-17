export const moduleBindingPatternFiles = Object.freeze({
  "effects.ts": `
import type { int32 } from "@tsonic/core/types.js";
let trace: int32 = 0;
export function record(value: int32): int32 { trace = trace * 10 + value; return value; }
export function observed(): int32 { return trace; }
`,
  "state.ts": `
import type { int32 } from "@tsonic/core/types.js";
import { record } from "./effects.js";
interface Payload { count: int32; }
interface Source { first: int32; nested: { second: int32 }; missing?: int32; present: int32; payload: Payload; }
function root(): Source {
  record(1);
  return { first: 2, nested: { second: 3 }, present: 4, payload: { count: 5 } };
}
export let { first, nested: { second }, missing = record(first), present = record(9), payload } = root();
function values(): int32[] { record(3); return []; }
export const [head = record(4), next = record(head + 1)] = values();
export const [, skipped, ...rest] = [6, 7, 8, 9] as const;
const {} = { ignored: record(6) };
export function replace(): void { first = 8; payload = { count: 9 }; }
`,
  "index.ts": `
import { first, second, missing, present, payload, head, next, rest, skipped, replace } from "./state.js";
import { observed } from "./effects.js";
import type { int32 } from "@tsonic/core/types.js";
function same(value: int32, expected: int32): boolean { return value === expected; }
export function run(): boolean {
  if (observed() !== 123456 || !same(first, 2) || second !== 3 || missing !== 2 || present !== 4 ||
    head !== 4 || next !== 5 || rest[0] !== 8 || rest[1] !== 9 || skipped !== 7) return false;
  const alias = payload;
  alias.count = 7;
  if (!same(payload.count, 7)) return false;
  replace();
  return first === 8 && alias.count === 7 && payload.count === 9 && payload !== alias;
}
if (!run()) throw new Error("module pattern initialization contract");
`,
});
