export const closedArrayPredicateFiles = {
  "paths.ts": `
export type Path = string | RegExp | readonly Path[];
export function isList(value: Path | null | undefined): boolean { return Array.isArray(value); }
export function broad(value: unknown): boolean { return Array.isArray(value); }
export class Other {
  isArray(value: string[]): boolean { return value.length === 0; }
}
`,
  "index.ts": `
import { isList, broad, Other } from "./paths.js";
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
  return effect && count === 1 && isList(paths) && paths.length === 4 &&
    !isList("text") && !isList(/pattern/) && !isList(null) && !isList(undefined) &&
    !Array.isArray("text") && Array.isArray(empty) && !Array.isArray(4) && !Array.isArray({ length: 0 }) &&
    !broad(false) && !broad("text") && broad(JSON.parse("[1,2]")) && !broad(JSON.parse("{}")) &&
    other.isArray(empty) && !other.isArray(["not empty"]);
}
`,
};
