export const recursiveArrayRefinementSource = `
type Tree = number | readonly Tree[];
function size(tree: Tree): number {
  if (typeof tree === "number") return 0;
  if (Array.isArray(tree)) return tree.length;
  return 0;
}
type Mutable = number | number[];
function append(value: Mutable): number {
  if (typeof value === "number") return 0;
  if (Array.isArray(value)) {
    value.push(7);
    return value.length;
  }
  return 0;
}
export function run(): boolean {
  const tree: Tree = [1, [2, 3]];
  const values: number[] = [1, 2];
  return size(tree) === 2 && size(8) === 0 && size([]) === 0 &&
    append(values) === 3 && values.length === 3 && values[2] === 7 && append(8) === 0;
}
`;

export const arrayRecordRefinementSource = `
type Measured = { length: number } | readonly number[];
function measure(value: Measured): number {
  if (Array.isArray(value)) return value.length + 10;
  return value.length;
}
function inverse(value: Measured): number {
  if (!Array.isArray(value)) return value.length;
  return value.length + 10;
}
function alias(value: Measured): number {
  const same: Measured = value;
  if (Array.isArray(same)) return same.length + 10;
  return same.length;
}
function changed(value: Measured): number {
  if (Array.isArray(value)) {
    value = { length: 9 };
    return value.length;
  }
  return value.length;
}
function later(value: Measured): number {
  if (Array.isArray(value)) {
    const result = value.length + 10;
    value = { length: 99 };
    return result + value.length - 99;
  }
  return value.length;
}
export function run(): boolean {
  return measure({ length: 7 }) === 7 && measure([1, 2]) === 12 &&
    inverse({ length: 7 }) === 7 && inverse([1, 2]) === 12 &&
    alias({ length: 7 }) === 7 && alias([1, 2]) === 12 &&
    changed({ length: 7 }) === 7 && changed([1, 2]) === 9 &&
    later({ length: 7 }) === 7 && later([1, 2]) === 12;
}
`;

export const multipleArrayRefinementSource = `
import type { int64 } from "@tsonic/core/types.js";
type Measured = { length: number } | readonly int64[] | readonly string[];
function measure(value: Measured): number {
  if (Array.isArray(value)) return value.length + 10;
  return value.length;
}
function inverse(value: Measured): number {
  if (!Array.isArray(value)) return value.length;
  return value.length + 10;
}
function alias(value: Measured): number {
  const same: Measured = value;
  if (Array.isArray(same)) return same.length + 10;
  return same.length;
}
function changed(value: Measured): number {
  if (Array.isArray(value)) {
    value = { length: 9 };
    return value.length;
  }
  return value.length;
}
export function run(): boolean {
  const integers: int64[] = [9007199254740993n, 2n];
  const strings: string[] = ["a", "b", "c"];
  return measure({ length: 7 }) === 7 && measure(integers) === 12 && measure(strings) === 13 &&
    inverse({ length: 7 }) === 7 && inverse(integers) === 12 && inverse(strings) === 13 &&
    alias({ length: 7 }) === 7 && alias(integers) === 12 && alias(strings) === 13 &&
    changed({ length: 7 }) === 7 && changed(integers) === 9 && changed(strings) === 9 &&
    integers[0] === 9007199254740993n && strings[2] === "c";
}
`;

export const genericArrayRefinementFiles = {
  "measured.ts": `export type Measured<Value> = ({ length: number } | readonly Value[] | readonly string[]);`,
  "public.ts": `export type { Measured } from "./measured.js";`,
  "measure.ts": `
import type { int64 } from "@tsonic/core/types.js";
import type { Measured } from "./public.js";
export function measure(value: Measured<int64>): number {
  if (Array.isArray(value)) return value.length + 10;
  return value.length;
}
`,
  "index.ts": `
import type { int64 } from "@tsonic/core/types.js";
import { measure } from "./measure.js";
export function run(): boolean {
  const values: int64[] = [9007199254740993n, 2n];
  return measure(values) === 12 && measure(["a", "b", "c"]) === 13 &&
    measure({ length: 7 }) === 7 && values[0] === 9007199254740993n;
}
`,
};

export const conflictingArrayRefinementFiles = {
  ...genericArrayRefinementFiles,
  "index.ts": `
import type { uint64 } from "@tsonic/core/types.js";
import { measure } from "./measure.js";
export function run(): boolean {
  const values: uint64[] = [18446744073709551615n];
  return measure(values) === 11;
}
`,
};
