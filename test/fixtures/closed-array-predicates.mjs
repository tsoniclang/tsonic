export const closedArrayPredicateFiles = {
  "paths.ts": `
export type Path = string | RegExp | readonly Path[];
export function isList(value: Path | null | undefined): boolean { return Array.isArray(value); }
export function broad(value: unknown): boolean { return Array.isArray(value); }
export function total(value: Path | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return value.length;
  if (value instanceof RegExp) return 0;
  if (Array.isArray(value)) {
    let size = 0;
    for (let index = 0; index < value.length; index++) size += total(value[index]!);
    return size;
  }
  return 0;
}
export function first(value: readonly Path[] | null | undefined): number {
  if (Array.isArray(value) && value.length > 0) return total(value[0]);
  return 0;
}
export function rewrite(value: string | readonly string[] | undefined): void {
  if (Array.isArray(value) && value.length > 0) value[0] = "rewritten";
}
export function bump(value: readonly number[] | null | undefined): void {
  if (Array.isArray(value) && value.length > 0) value[0] += 2;
}
export function update(value: readonly number[] | null | undefined): number {
  if (Array.isArray(value) && value.length > 0) {
    const previous = value[0]++;
    const next = ++value[0];
    return previous * 10 + next;
  }
  return 0;
}
export function rebound(): boolean {
  let value: number[] = [1];
  const original = value;
  let calls = 0;
  const index = (): number => { calls++; value = [9]; return 0; };
  value[index()] += 2;
  if (original[0] !== 3 || value[0] !== 9 || calls !== 1) return false;
  const selected = value;
  const replace = (): number => { value = [12]; return 4; };
  value[0] += replace();
  return selected[0] === 13 && value[0] === 12;
}
export class Other {
  isArray(value: string[]): boolean { return value.length === 0; }
}
`,
  "index.ts": `
import { isList, broad, total, first, rewrite, bump, update, rebound, Other } from "./paths.js";
import type { Path } from "./paths.js";
export function run(): boolean {
  const paths: Path[] = ["route", /pattern/, ["nested"]];
  const alias = paths;
  let calls = 0;
  const selected = (): Path => { calls++; return paths; };
  const effect = Array.isArray(selected());
  const count = calls;
  alias.push("last");
  const empty: string[] = [];
  const other = new Other();
  const edited = ["old"];
  const same = edited;
  rewrite(edited);
  rewrite(undefined);
  rewrite("not an array");
  const counted: number[] = [2];
  const countedAlias = counted;
  bump(counted);
  bump(null);
  bump(undefined);
  const updated: number[] = [3];
  const updatedAlias = updated;
  const updateResult = update(updated);
  return effect && count === 1 && isList(paths) && paths.length === 4 &&
    total(paths) === 15 && total(alias) === 15 && total(null) === 0 && total(undefined) === 0 &&
    first(paths) === 5 && first(null) === 0 && first(undefined) === 0 && same[0] === "rewritten" && countedAlias[0] === 4 &&
    updateResult === 35 && updatedAlias[0] === 5 && update(null) === 0 && update(undefined) === 0 && rebound() &&
    !isList("text") && !isList(/pattern/) && !isList(null) && !isList(undefined) &&
    !Array.isArray("text") && Array.isArray(empty) && !Array.isArray(4) && !Array.isArray({ length: 0 }) &&
    !broad(false) && !broad("text") && broad(JSON.parse("[1,2]")) && !broad(JSON.parse("{}")) &&
    other.isArray(empty) && !other.isArray(["not empty"]);
}
`,
};
