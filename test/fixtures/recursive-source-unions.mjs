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

export const recursiveCollectionUnionFiles = {
  "tree.ts": `
export type Tree = number | readonly Tree[];
export function sum(tree: Tree): number {
  if (typeof tree === "number") return tree;
  let total = 0;
  for (const child of tree) total += sum(child);
  return total;
}
`,
  "index.ts": `
import { sum } from "./tree.js";
import type { Tree } from "./tree.js";
function identity(tree: Tree): Tree { return tree; }
export function run(): boolean {
  return sum([2, [3, 4]]) === 9 && sum([]) === 0;
}
`,
};

export const recursiveCollectionUnionIdentitySource = `
export function aliases(): boolean {
  const children: Tree[] = [2, [3, 4]];
  const root: Tree = children;
  if (sum(identity(root)) !== 9 || identity(root) !== root) return false;
  children[0] = 7;
  return sum(root) === 14;
}
`;

export const recursiveGenericCollectionUnionFiles = {
  "tree.ts": `
export type Tree<Value> = Value | readonly Tree<Value>[];
export function sum(tree: Tree<number>): number {
  if (typeof tree === "number") return tree;
  let total = 0;
  for (const child of tree) total += sum(child);
  return total;
}
export function text(tree: Tree<string>): string {
  if (typeof tree === "string") return tree;
  let result = "";
  for (const child of tree) result += text(child);
  return result;
}
`,
  "index.ts": `
import { sum, text } from "./tree.js";
import type { Tree } from "./tree.js";
function keep<Value>(tree: Tree<Value>): Tree<Value> { return tree; }
export function run(): boolean {
  const numbers: Tree<number> = [2, [3, 4]];
  const strings: Tree<string> = ["left", ["middle", "right"]];
  return sum(keep<number>(numbers)) === 9 && text(keep<string>(strings)) === "leftmiddleright";
}
`,
};

export const recursiveOptionalCollectionUnionFiles = {
  "tree.ts": `
export type Tree = number | readonly Tree[] | null | undefined;
export type Children = readonly Children[] | null | undefined;
export function sum(tree: Tree): number {
  if (tree == null) return 0;
  if (typeof tree === "number") return tree;
  let result = 0;
  for (const child of tree) result += sum(child);
  return result;
}
export function count(children: Children): number {
  if (children == null) return 1;
  let result = 0;
  for (const child of children) result += count(child);
  return result;
}
export function coalesce(tree: Tree): number { return sum(tree ?? 0); }
export function first(children: Children): Children { return children?.[0]; }
let receiverCalls = 0;
let indexCalls = 0;
function receiver(children: Children): Children { receiverCalls += 1; return children; }
function index() { indexCalls += 1; return 0; }
export function guardedEvaluation(): boolean {
  receiverCalls = 0;
  indexCalls = 0;
  const absent = receiver(null)?.[index()];
  const present = receiver([[null, [undefined]]])?.[index()];
  return absent == null && count(present) === 2 && receiverCalls === 2 && indexCalls === 1;
}
`,
  "index.ts": `
import { coalesce, count, first, sum, guardedEvaluation } from "./tree.js";
export function run(): boolean {
  return sum([2, undefined, [null, 3]]) === 5 && count([null, [undefined]]) === 2 &&
    coalesce(undefined) === 0 && coalesce([2, [null, 3]]) === 5 &&
    count(first(null)) === 1 && count(first([[null, [undefined]]])) === 2 && guardedEvaluation();
}
`,
};

export const recursiveOptionalCollectionUnionJsFiles = {
  "tree.ts": `${recursiveOptionalCollectionUnionFiles["tree.ts"]}
export function length(children: Children): number { return children?.length ?? 0; }
`,
  "index.ts": `${recursiveOptionalCollectionUnionFiles["index.ts"].replace("export function run()", "function values()")}
import { length } from "./tree.js";
export function run(): boolean { return values() && length(null) === 0 && length([null, [undefined]]) === 2; }
`,
};
