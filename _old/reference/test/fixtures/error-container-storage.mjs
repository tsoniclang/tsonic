export const errorContainerStorageFiles = Object.freeze({
  "mutate.ts": `
export function writeArray(values: Error[]): void {
  values[0].name = "Changed";
  values[0].message = "changed";
  values[0].stack = "authored";
}
export function writeTuple(values: [Error, Error]): void { values[1].message = "tuple"; }
export function nested(values: Error[][]): Error[] { return values[0]; }
export function observe(error: Error, message: string): boolean { return error.message === message; }
`,
  "index.ts": `
import { nested, observe, writeArray, writeTuple } from "./mutate.js";
export function run(): boolean {
  const original = new Error("original");
  const untouched = new Error("untouched");
  const values: Error[] = [original];
  const alias = values;
  writeArray(alias);
  if (values[0] !== original || alias[0] !== original || !observe(original, "changed")) return false;
  if (original.name !== "Changed" || original.stack !== "authored") return false;
  if (!observe(untouched, "untouched") || untouched.stack !== undefined) return false;
  const first = new Error("first");
  const second = new Error("second");
  const pair: [Error, Error] = [first, second];
  writeTuple(pair);
  if (pair[0] !== first || pair[1] !== second || !observe(first, "first") || !observe(second, "tuple")) return false;
  const deep = new Error("deep");
  const outer: Error[][] = [[deep]];
  const result = nested(outer);
  writeArray(result);
  if (outer[0][0] !== deep || result[0] !== deep || !observe(deep, "changed")) return false;
  const spreadFirst = new Error("spread-first");
  const spreadSecond = new Error("spread-second");
  const spreadPair: [Error, Error] = [spreadFirst, spreadSecond];
  const spread: Error[] = [...spreadPair];
  writeArray(spread);
  if (spread[0] !== spreadFirst || spread[1] !== spreadSecond || !observe(spreadFirst, "changed") || !observe(spreadSecond, "spread-second")) return false;
  const [selected] = values;
  selected.message = "destructured";
  return selected === original && observe(original, "destructured") && observe(untouched, "untouched");
}
`,
});

export const readonlyErrorContainerStorageFiles = Object.freeze({
  "mutate.ts": `
export class MutableFailure extends Error {
  detail: string;
  label: string = "MutableFailure";
  trace: string | undefined = undefined;
  constructor(message: string) { super(message); this.detail = message; }
}
export function writeArray(values: MutableFailure[]): void {
  values[0].label = "Changed";
  values[0].detail = "changed";
  values[0].trace = "authored";
}
export function writeTuple(values: [MutableFailure, MutableFailure]): void { values[1].detail = "tuple"; }
export function nested(values: MutableFailure[][]): MutableFailure[] { return values[0]; }
export function observe(error: MutableFailure, message: string): boolean { return error.detail === message; }
export function nativeMessage(error: Error, message: string): boolean { return error.message === message; }
export function nativeArray(values: Error[]): Error[] { return values; }
`,
  "index.ts": `
import { MutableFailure, nativeArray, nativeMessage, nested, observe, writeArray, writeTuple } from "./mutate.js";
export function run(): boolean {
  const original = new MutableFailure("original");
  const untouched = new MutableFailure("untouched");
  const nativeValues: Error[] = [original];
  const nativeAlias = nativeArray(nativeValues);
  const values: MutableFailure[] = [original];
  const alias = values;
  writeArray(alias);
  if (values[0] !== original || alias[0] !== original || !observe(original, "changed")) return false;
  if (nativeAlias !== nativeValues || nativeAlias[0] !== original || !nativeMessage(nativeAlias[0], "original")) return false;
  if (original.label !== "Changed" || original.trace !== "authored" || original.stack !== undefined) return false;
  if (!observe(untouched, "untouched") || untouched.trace !== undefined || !nativeMessage(untouched, "untouched")) return false;
  const first = new MutableFailure("first");
  const second = new MutableFailure("second");
  const pair: [MutableFailure, MutableFailure] = [first, second];
  writeTuple(pair);
  if (pair[0] !== first || pair[1] !== second || !observe(first, "first") || !observe(second, "tuple")) return false;
  const deep = new MutableFailure("deep");
  const outer: MutableFailure[][] = [[deep]];
  const result = nested(outer);
  writeArray(result);
  if (outer[0][0] !== deep || result[0] !== deep || !observe(deep, "changed")) return false;
  const spreadFirst = new MutableFailure("spread-first");
  const spreadSecond = new MutableFailure("spread-second");
  const spreadPair: [MutableFailure, MutableFailure] = [spreadFirst, spreadSecond];
  const spread: MutableFailure[] = [...spreadPair];
  writeArray(spread);
  if (spread[0] !== spreadFirst || spread[1] !== spreadSecond || !observe(spreadFirst, "changed") || !observe(spreadSecond, "spread-second")) return false;
  const [selected] = values;
  selected.detail = "destructured";
  return selected === original && observe(original, "destructured") && observe(untouched, "untouched") &&
    nativeMessage(original, "original") && nativeMessage(second, "second") && nativeMessage(deep, "deep");
}
`,
});
