export const unionAliasArrayFiles = Object.freeze({
  "contracts.ts": `
export type Inner = boolean | string;
export type Entry = number | boolean | string;
export type Equivalent = string | boolean | number;
`,
  "index.ts": `
import type { Inner, Entry, Equivalent } from "./contracts.js";

export function accept(values: readonly (Inner | number)[]): number {
  let result = 0;
  for (const value of values) if (typeof value === "number") result += value;
  return result;
}

export function forward(values: Entry[]): number { return accept(values); }
export function equivalent(values: Equivalent[]): number { return forward(values); }

export function run(): boolean {
  return forward([1, "text", true, 2]) === 3 && equivalent([false, 4, "text", 5]) === 9;
}

export function main(): void {
  if (!run()) throw new Error("union alias arrays");
}
`,
});
