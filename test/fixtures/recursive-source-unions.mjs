export const recursiveSourceUnionFiles = {
  "steps.ts": `
export type Step<Value> = {
  readonly kind: "done";
  readonly value: Value;
} | {
  readonly kind: "read";
  readonly resume: (count: number) => Step<Value>;
};
export function done<Value>(value: Value): Step<Value> {
  return { kind: "done", value };
}
export function delayed<Value>(value: Value): Step<Value> {
  return { kind: "read", resume: (count: number): Step<Value> => done(value) };
}
export function complete<Value>(step: Step<Value>): Value {
  if (step.kind === "done") return step.value;
  return complete(step.resume(4));
}
`,
  "left.ts": `
import type { Right } from "./right.js";
export type Left = { readonly kind: "left"; readonly next: () => Right }
  | { readonly kind: "done"; readonly value: number };
export function readLeft(value: Left): number {
  if (value.kind === "done") return value.value;
  const next = value.next();
  if (next.kind === "done") return next.value;
  return readLeft(next.next());
}
`,
  "right.ts": `
import type { Left } from "./left.js";
export type Right = { readonly kind: "right"; readonly next: () => Left }
  | { readonly kind: "done"; readonly value: number };
`,
  "index.ts": `
import { complete, delayed, done } from "./steps.js";
import { readLeft } from "./left.js";
import type { Left } from "./left.js";
import type { Right } from "./right.js";
export function run(): boolean {
  if (complete(done(3)) !== 3) return false;
  const numberStep = delayed(7);
  if (complete(numberStep) !== 7 || complete(numberStep) !== 7) return false;
  if (complete(delayed("retained")) !== "retained") return false;
  const left: Left = { kind: "left", next: (): Right => ({
    kind: "right", next: (): Left => ({ kind: "done", value: 11 }),
  }) };
  return readLeft(left) === 11;
}
`,
};
