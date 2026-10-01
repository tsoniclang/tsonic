export const nestedUnionProjectionFiles = {
  "models.ts": `
import type { uint64 } from "@tsonic/core/types.js";
export class Entry {
  value: uint64;
  constructor(value: uint64) { this.value = value; }
  advance(): uint64 { const unit: uint64 = 1n; this.value += unit; return this.value; }
}
export type Entries = Entry | readonly uint64[];
export type TextOrAction = string | ((value: uint64) => uint64);
export type Grouped = Entries | TextOrAction;
export type OptionalGrouped = Grouped | null | undefined;
`,
  "aliases.ts": 'export { Entry } from "./models.js"; export type { Entries, TextOrAction, Grouped, OptionalGrouped } from "./models.js";',
  "index.ts": `
import type { uint64 } from "@tsonic/core/types.js";
import { Entry } from "./aliases.js";
import type { Entries, TextOrAction, Grouped, OptionalGrouped } from "./aliases.js";
function read(value: Entries | TextOrAction): uint64 {
  if (value instanceof Entry) return value.advance();
  if (typeof value === "function") return value(3n);
  if (typeof value === "string") return 0n;
  return value[0];
}
function readOptional(value: OptionalGrouped): uint64 {
  if (value === null || value === undefined) return 0n;
  return read(value);
}
function present(value: Entries | TextOrAction | null | undefined): boolean {
  return value instanceof Entry;
}
export function run(): boolean {
  const wide: uint64 = 9007199254740993n;
  const first: uint64 = 9007199254740994n;
  const second: uint64 = 9007199254740995n;
  const third: uint64 = 9007199254740996n;
  const entry = new Entry(wide);
  const selected: Grouped = entry;
  if (read(selected) !== first || entry.value !== first) return false;
  let calls = 0;
  const next = (): Grouped => { calls++; return entry; };
  const matched = next() instanceof Entry;
  if (!matched || calls !== 1) return false;
  return read([wide]) === wide && read("text") === 0n &&
    read((value: uint64): uint64 => wide + value) === third &&
    readOptional(null) === 0n && readOptional(undefined) === 0n &&
    readOptional(entry) === second && present(entry) &&
    !present(null) && !present(undefined) && !present("text");
}
`,
};
